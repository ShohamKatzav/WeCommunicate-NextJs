"use server"
import { env } from '@/app/config/env';
import Brevo from '@getbrevo/brevo';
import { createUser, isExist, updatePassword } from './accountActions';
import { isEmail, isPhone, normalizePhone, type VerificationChannel } from './contact';
import RedisService from '@/services/RedisService';
import { cookies } from 'next/headers';

const emailApi = new Brevo.TransactionalEmailsApi();
emailApi.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, env.BREVO_API_KEY!);
const key = (contact: string, channel: VerificationChannel) => `${channel}:${channel === 'sms' ? normalizePhone(contact) : contact.trim().toLowerCase()}`;
const newCode = () => Math.floor(100000 + Math.random() * 900000).toString();
async function sendCode(contact: string, channel: VerificationChannel, otp: string) {
  if (channel === 'sms') {
    const result = await fetch('https://api.brevo.com/v3/transactionalSMS/send', { method: 'POST', headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json' }, body: JSON.stringify({ sender: env.BREVO_SMS_SENDER, recipient: normalizePhone(contact).slice(1), content: `Your WeCommunicate code is ${otp}. It expires in 10 minutes.`, type: 'transactional' }) });
    if (!result.ok) throw new Error(`Brevo SMS failed (${result.status})`); return;
  }
  const message = new Brevo.SendSmtpEmail(); message.to = [{ email: contact }]; message.sender = { name: 'WeCommunicate', email: env.SMTP_USER }; message.subject = 'Your WeCommunicate verification code'; message.htmlContent = `<p>Your verification code is <strong>${otp}</strong>.</p><p>It expires in 10 minutes.</p>`;
  await emailApi.sendTransacEmail(message);
}
export async function requestOTP(contact: string, mode: 'sign-up' | 'forgot', channel: VerificationChannel = 'email') {
  if (!(channel === 'sms' ? isPhone(contact) : isEmail(contact))) return { message: channel === 'sms' ? 'Use an international phone number, e.g. +972 50 123 4567' : 'Enter a valid email address', status: 400 };
  const exists = await isExist(contact); if (mode === 'sign-up' && exists.accountExists) return { message: `An account already exists for this ${channel === 'sms' ? 'phone number' : 'email address'}`, status: 400 }; if (mode === 'forgot' && !exists.accountExists) return { status: 200 };
  try { const otp = newCode(); await RedisService.addOTP(key(contact, channel), { OTP: otp, expiresAt: Date.now() + 600000 }); await sendCode(contact, channel, otp); return { status: 200 }; } catch (error) { console.error(error); return { message: 'Unable to send code. Check Brevo SMS credits and sender settings.', status: 500 }; }
}
export async function verifyOTP(contact: string, otp: string, channel: VerificationChannel = 'email') {
  if (!/^\d{6}$/.test(otp)) return { message: 'OTP must be 6 digits', status: 400 };
  const e2eCookie = (await cookies()).get('e2e')?.value;
  if (env.E2E_TEST === 'true' && env.TEST_BYPASS_KEY && e2eCookie === env.TEST_BYPASS_KEY && otp === '000000') {
    return { status: 200 };
  }
  const stored = await RedisService.getOTPByEmail(key(contact, channel));
  return !stored || Date.now() > stored.expiresAt || stored.OTP !== otp ? { message: 'Invalid or expired verification code', status: 400 } : { status: 200 };
}
export async function createAccount(contact: string, otp: string, password: string, nickname = '', channel: VerificationChannel = 'email') { const verified = await verifyOTP(contact, otp, channel); if (verified.status !== 200) return verified; const result = await createUser(contact, password, nickname); if (result.status < 300) await RedisService.deleteOTP(key(contact, channel)); return result; }
export async function resetPassword(contact: string, otp: string, password: string, channel: VerificationChannel = 'email') { const verified = await verifyOTP(contact, otp, channel); if (verified.status !== 200) return verified; const result = await updatePassword(contact, password); if (result.status < 300) await RedisService.deleteOTP(key(contact, channel)); return result; }
