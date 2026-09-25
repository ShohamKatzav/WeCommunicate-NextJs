"use server"
import { randomInt } from 'node:crypto';
import { env } from '@/app/config/env';
import Brevo from '@getbrevo/brevo';
import { createUser, isExist } from './accountActions';
import { updateAccountPassword } from './accountHelpers';
import { isEmail, isPhone, normalizePhone, otpContactKey, type VerificationChannel } from './contact';
import RedisService from '@/services/RedisService';
import { isTestBypass } from './testBypass';
import { cookies } from 'next/headers';
import { getT } from '@/app/i18n/server';

const emailApi = new Brevo.TransactionalEmailsApi();
emailApi.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, env.BREVO_API_KEY!);
const key = otpContactKey;
// Cryptographically secure - Math.random() is guessable and unsuitable for a
// security-sensitive code.
const newCode = () => randomInt(100000, 1000000).toString();
const OTP_SEND_COOLDOWN_SECONDS = 60;
const OTP_ATTEMPT_WINDOW_SECONDS = 900;
const MAX_OTP_ATTEMPTS = 5;

// In the language the requesting page was shown in.
async function sendCode(contact: string, channel: VerificationChannel, otp: string) {
  const t = await getT();
  if (channel === 'sms') {
    const result = await fetch('https://api.brevo.com/v3/transactionalSMS/send', { method: 'POST', headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json' }, body: JSON.stringify({ sender: env.BREVO_SMS_SENDER, recipient: normalizePhone(contact).slice(1), content: t('email.otpSms', { code: otp }), type: 'transactional' }) });
    if (!result.ok) throw new Error(`Brevo SMS failed (${result.status})`); return;
  }
  const message = new Brevo.SendSmtpEmail(); message.to = [{ email: contact }]; message.sender = { name: 'WeCommunicate', email: env.SMTP_USER }; message.subject = t('email.otpSubject'); message.htmlContent = `<div dir="${t.locale === 'he' || t.locale === 'ar' ? 'rtl' : 'ltr'}">${t('email.otpBody', { code: otp })}</div>`;
  await emailApi.sendTransacEmail(message);
}
export async function requestOTP(contact: string, mode: 'sign-up' | 'forgot' | 'change-phone' | 'change-email' | 'delete-account', channel: VerificationChannel = 'email') {
  const t = await getT();
  if (!(channel === 'sms' ? isPhone(contact) : isEmail(contact))) return { message: channel === 'sms' ? t('errors.invalidPhone') : t('errors.invalidEmail'), status: 400 };
  // 'change-phone' always targets a contact already on the caller's own
  // account - the account email for profileActions.ts's phone-number-change
  // flow, or (reused as-is, same behavior) the account's own phone for the
  // first step of its email-change flow - so neither the sign-up "already
  // taken" guard nor the forgot-password "pretend success for a nonexistent
  // account" guard applies; it falls straight through to sending a real code
  // below. 'change-email' is the email-change flow's second step, sending to
  // the *new* address the caller doesn't own yet - it must refuse an address
  // already claimed by another account, like sign-up, but "wrong meaning" is
  // avoided by not reusing 'sign-up' itself. 'delete-account' is like
  // 'change-phone': the contact is always the caller's own, loaded from their
  // session account by accountDeletionActions.ts.
  const exists = await isExist(contact); if ((mode === 'sign-up' || mode === 'change-email') && exists.accountExists) return { message: channel === 'sms' ? t('errors.accountExistsPhone') : t('errors.accountExistsEmail'), status: 400 }; if (mode === 'forgot' && !exists.accountExists) return { status: 200 };

  const otpKey = key(contact, channel);
  if (!(await isTestBypass())) {
    // Without this, requestOTP can be looped to drain Brevo's free email/SMS
    // quota - the client-side 60s timer in OTPProcess.tsx is only cosmetic.
    const allowedToSend = await RedisService.startOTPSendCooldown(otpKey, OTP_SEND_COOLDOWN_SECONDS);
    if (!allowedToSend) {
      return { message: t('errors.waitBeforeResend'), status: 429 };
    }
  }

  try { const otp = newCode(); await RedisService.addOTP(otpKey, { OTP: otp, expiresAt: Date.now() + 600000 }); await sendCode(contact, channel, otp); return { status: 200 }; } catch (error) { console.error(error); return { message: t('errors.cannotSendCode'), status: 500 }; }
}
export async function verifyOTP(contact: string, otp: string, channel: VerificationChannel = 'email') {
  const t = await getT();
  if (!/^\d{6}$/.test(otp)) return { message: t('errors.codeMustBeSixDigits'), status: 400 };
  const e2eCookie = (await cookies()).get('e2e')?.value;
  if (env.E2E_TEST === 'true' && env.TEST_BYPASS_KEY && e2eCookie === env.TEST_BYPASS_KEY && otp === '000000') {
    return { status: 200 };
  }

  const otpKey = key(contact, channel);
  if (!(await isTestBypass())) {
    // A 6-digit code is only safe if guessing it is rate-limited - without
    // this, ~10^6 unlimited, parallelizable attempts fit inside the
    // 10-minute expiry window.
    const attempts = await RedisService.incrOTPAttempts(otpKey, OTP_ATTEMPT_WINDOW_SECONDS);
    if (attempts > MAX_OTP_ATTEMPTS) {
      return { message: t('errors.tooManyCodeAttempts'), status: 429 };
    }
  }

  const stored = await RedisService.getOTPByEmail(otpKey);
  return !stored || Date.now() > stored.expiresAt || stored.OTP !== otp ? { message: t('errors.invalidCode'), status: 400 } : { status: 200 };
}
export async function createAccount(contact: string, otp: string, password: string, nickname = '', channel: VerificationChannel = 'email') { const verified = await verifyOTP(contact, otp, channel); if (verified.status !== 200) return verified; const result = await createUser(contact, password, nickname); if (result.status < 300) await RedisService.deleteOTP(key(contact, channel)); return result; }
export async function resetPassword(contact: string, otp: string, password: string, channel: VerificationChannel = 'email') { const verified = await verifyOTP(contact, otp, channel); if (verified.status !== 200) return verified; const result = await updateAccountPassword(contact, password); if (result.status < 300) await RedisService.deleteOTP(key(contact, channel)); return result; }
// Exposed so other flows that verify an OTP outside sign-up/forgot (e.g.
// profileActions.ts's phone-number change) can clear the used code without
// needing to know the internal contact+channel key format.
export async function deleteOTP(contact: string, channel: VerificationChannel = 'email') { await RedisService.deleteOTP(key(contact, channel)); }
