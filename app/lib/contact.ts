export type VerificationChannel = 'email' | 'sms';
export const normalizePhone = (value: string) => value.replace(/[\s()-]/g, '');
export const isPhone = (value: string) => /^\+[1-9]\d{7,14}$/.test(normalizePhone(value));
export const isEmail = (value?: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value ? value.trim() : '');
// The Redis key an OTP for this contact lives under (RedisService prefixes
// otp:/otp_attempts:/otp_cooldown:). Shared by OTPActions and account
// deletion, which has to find the same keys to remove them.
export const otpContactKey = (contact: string, channel: VerificationChannel) =>
    `${channel}:${channel === 'sms' ? normalizePhone(contact) : contact.trim().toLowerCase()}`;
