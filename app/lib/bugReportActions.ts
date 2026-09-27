"use server"
import { headers } from 'next/headers';
import jwt from 'jsonwebtoken';
import Brevo from '@getbrevo/brevo';
import { env } from '@/app/config/env';
import { getT } from '@/app/i18n/server';
import RedisService from '@/services/RedisService';
import { isTestBypass } from './testBypass';
import { getUserObJFromCoockie } from './cookieActions';
import { BUG_REPORT_MAX_LENGTH, BUG_REPORT_MIN_LENGTH } from '@/app/config/limits';

const emailApi = new Brevo.TransactionalEmailsApi();
emailApi.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, env.BREVO_API_KEY!);

const BUG_REPORT_TO = 'shohamkatzav95@gmail.com';
// One report a minute from the same address stops a double-tap or a script
// from turning the public form into a spam box; five an hour covers someone
// genuinely finding several bugs in one sitting.
const COOLDOWN_SECONDS = 60;
const HOURLY_LIMIT = 5;
// Brevo's free plan is 300 emails a day, shared with every OTP email. However
// many addresses a spammer rotates through, bug reports can't eat that.
const DAILY_LIMIT_ALL = 50;
const SOURCES: BugReportSource[] = ['button', 'contact', 'error'];

// Where the form was opened from, so a report from the error screen reads
// differently from one sent on a normal page.
export type BugReportSource = 'button' | 'contact' | 'error';
export type BugReportResult = { ok: true } | { ok: false; message: string };

// The first hop in X-Forwarded-For is whatever the client claimed, so the
// headers only a CDN in front of the app can set win when present. The daily
// cap above is what holds if all of these are spoofed.
async function clientAddress() {
    const h = await headers();
    return h.get('cf-connecting-ip')
        ?? h.get('true-client-ip')
        ?? h.get('x-forwarded-for')?.split(',')[0]?.trim()
        ?? h.get('x-real-ip')
        ?? 'unknown';
}

// The signed session token only - the cookie's other fields are whatever the
// browser sends. Anonymous (null) rather than an error: anyone can report.
async function signedInAccountId(): Promise<string | null> {
    try {
        const { token } = await getUserObJFromCoockie();
        if (!token) return null;
        const decoded = jwt.verify(token, env.JWT_SECRET_KEY) as { _id?: string };
        return decoded._id ?? null;
    } catch {
        return null;
    }
}

const escapeHtml = (value: string) => value
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Only an http(s) address, and without its #fragment. Anything else becomes
// a note instead of a link in the email.
function cleanPageUrl(raw: unknown) {
    if (typeof raw !== 'string') return 'unknown';
    try {
        const url = new URL(raw.slice(0, 2000));
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return 'unknown';
        url.hash = '';
        return url.toString();
    } catch {
        return 'unknown';
    }
}

// Goes to Shoham, so it is in English whatever language the reporter used -
// their locale is one of the listed details instead.
export async function sendBugReport(input: {
    whatHappened: string;
    expected?: string;
    pageUrl: string;
    viewport?: string;
    source: BugReportSource;
    errorDigest?: string;
}): Promise<BugReportResult> {
    const t = await getT();
    const whatHappened = typeof input?.whatHappened === 'string' ? input.whatHappened.trim() : '';
    const expected = typeof input?.expected === 'string' ? input.expected.trim() : '';
    if (whatHappened.length < BUG_REPORT_MIN_LENGTH) return { ok: false, message: t('bugReport.tooShort') };
    if (whatHappened.length > BUG_REPORT_MAX_LENGTH || expected.length > BUG_REPORT_MAX_LENGTH) {
        return { ok: false, message: t('bugReport.tooLong', { max: BUG_REPORT_MAX_LENGTH }) };
    }

    const bypass = await isTestBypass();
    const address = await clientAddress();
    if (!bypass) {
        if (!(await RedisService.checkRateLimit('bug-report', address, 1, COOLDOWN_SECONDS))) {
            return { ok: false, message: t('bugReport.rateLimited') };
        }
        if (!(await RedisService.checkRateLimit('bug-report-hourly', address, HOURLY_LIMIT, 3600))) {
            return { ok: false, message: t('bugReport.rateLimited') };
        }
        if (!(await RedisService.checkRateLimit('bug-report-daily', 'all', DAILY_LIMIT_ALL, 86400))) {
            return { ok: false, message: t('bugReport.busy') };
        }
    }

    const accountId = await signedInAccountId();
    const source = SOURCES.includes(input?.source) ? input.source : 'button';
    const pageUrl = cleanPageUrl(input?.pageUrl);
    const userAgent = (await headers()).get('user-agent') ?? 'unknown';
    const viewport = typeof input?.viewport === 'string' && /^\d{2,5}x\d{2,5}$/.test(input.viewport) ? input.viewport : 'unknown';
    const errorDigest = typeof input?.errorDigest === 'string' ? input.errorDigest.slice(0, 100) : '';

    const details: [string, string][] = [
        ['Page', pageUrl],
        ['Opened from', source === 'error' ? 'Error screen' : source === 'contact' ? 'Contact page' : 'Report a bug button'],
        ...(errorDigest ? [['Error digest', errorDigest] as [string, string]] : []),
        ['Locale', t.locale],
        ['Account ID', accountId ?? 'Not signed in'],
        ['User agent', userAgent],
        ['Viewport', viewport],
        ['Sent at', new Date().toISOString()],
    ];
    const paragraph = (text: string) => `<p style="white-space:pre-wrap;margin:0 0 16px">${escapeHtml(text)}</p>`;
    const html = [
        '<h2 style="margin:0 0 12px">What happened</h2>',
        paragraph(whatHappened),
        '<h2 style="margin:0 0 12px">What they expected</h2>',
        paragraph(expected || '(not given)'),
        '<table style="border-collapse:collapse;font-size:14px">',
        ...details.map(([label, value]) => `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;vertical-align:top">${label}</td><td style="padding:4px 0;word-break:break-all">${escapeHtml(value)}</td></tr>`),
        '</table>',
    ].join('');
    const text = [
        'What happened:', whatHappened, '',
        'What they expected:', expected || '(not given)', '',
        ...details.map(([label, value]) => `${label}: ${value}`),
    ].join('\n');

    // An e2e run exercises the whole form without mailing Shoham on every CI
    // push (see testBypass.ts - never active outside a test run).
    if (bypass) return { ok: true };

    try {
        const message = new Brevo.SendSmtpEmail();
        message.to = [{ email: BUG_REPORT_TO }];
        message.sender = { name: 'WeCommunicate', email: env.SMTP_USER };
        message.subject = `Bug report: ${whatHappened.replace(/\s+/g, ' ').slice(0, 70)}`;
        message.htmlContent = html;
        message.textContent = text;
        message.tags = ['bug-report'];
        await emailApi.sendTransacEmail(message);
        return { ok: true };
    } catch (error) {
        console.error('Failed to send bug report:', error);
        await RedisService.resetRateLimit('bug-report', address).catch(() => { });
        return { ok: false, message: t('bugReport.failed') };
    }
}
