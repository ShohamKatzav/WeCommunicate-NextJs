"use server"
import { randomInt } from 'node:crypto';
import { env } from '@/app/config/env';
import Brevo from '@getbrevo/brevo';
import { createUser, isExist } from './accountActions';
import { updateAccountPassword } from './accountHelpers';
import { isEmail, isPhone, normalizePhone, type VerificationChannel } from './contact';
import RedisService from '@/services/RedisService';
import { cookies } from 'next/headers';

const emailApi = new Brevo.TransactionalEmailsApi();
emailApi.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, env.BREVO_API_KEY!);
const key = (contact: string, channel: VerificationChannel) => `${channel}:${channel === 'sms' ? normalizePhone(contact) : contact.trim().toLowerCase()}`;
// Cryptographically secure - Math.random() is guessable and unsuitable for a
// security-sensitive code.
const newCode = () => randomInt(100000, 1000000).toString();
const OTP_SEND_COOLDOWN_SECONDS = 60;
const OTP_ATTEMPT_WINDOW_SECONDS = 900;
const MAX_OTP_ATTEMPTS = 5;

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

  const otpKey = key(contact, channel);
  // Without this, requestOTP can be looped to drain Brevo's free email/SMS
  // quota - the client-side 60s timer in OTPProcess.tsx is only cosmetic.
  const allowedToSend = await RedisService.startOTPSendCooldown(otpKey, OTP_SEND_COOLDOWN_SECONDS);
  if (!allowedToSend) {
    return { message: 'Please wait a bit before requesting another code.', status: 429 };
  }

  try { const otp = newCode(); await RedisService.addOTP(otpKey, { OTP: otp, expiresAt: Date.now() + 600000 }); await sendCode(contact, channel, otp); return { status: 200 }; } catch (error) { console.error(error); return { message: 'Unable to send code. Check Brevo SMS credits and sender settings.', status: 500 }; }
}
export async function verifyOTP(contact: string, otp: string, channel: VerificationChannel = 'email') {
  if (!/^\d{6}$/.test(otp)) return { message: 'OTP must be 6 digits', status: 400 };
  const e2eCookie = (await cookies()).get('e2e')?.value;
  if (env.E2E_TEST === 'true' && env.TEST_BYPASS_KEY && e2eCookie === env.TEST_BYPASS_KEY && otp === '000000') {
    return { status: 200 };
  }

  const otpKey = key(contact, channel);
  // A 6-digit code is only safe if guessing it is rate-limited - without
  // this, ~10^6 unlimited, parallelizable attempts fit inside the 10-minute
  // expiry window.
  const attempts = await RedisService.incrOTPAttempts(otpKey, OTP_ATTEMPT_WINDOW_SECONDS);
  if (attempts > MAX_OTP_ATTEMPTS) {
    return { message: 'Too many attempts. Please request a new code and try again later.', status: 429 };
  }

  const stored = await RedisService.getOTPByEmail(otpKey);
  return !stored || Date.now() > stored.expiresAt || stored.OTP !== otp ? { message: 'Invalid or expired verification code', status: 400 } : { status: 200 };
}
export async function createAccount(contact: string, otp: string, password: string, nickname = '', channel: VerificationChannel = 'email') { const verified = await verifyOTP(contact, otp, channel); if (verified.status !== 200) return verified; const result = await createUser(contact, password, nickname); if (result.status < 300) await RedisService.deleteOTP(key(contact, channel)); return result; }
export async function resetPassword(contact: string, otp: string, password: string, channel: VerificationChannel = 'email') { const verified = await verifyOTP(contact, otp, channel); if (verified.status !== 200) return verified; const result = await updateAccountPassword(contact, password); if (result.status < 300) await RedisService.deleteOTP(key(contact, channel)); return result; }
