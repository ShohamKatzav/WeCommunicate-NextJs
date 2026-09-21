export type VerificationChannel = 'email' | 'sms';
export const normalizePhone = (value: string) => value.replace(/[\s()-]/g, '');
export const isPhone = (value: string) => /^\+[1-9]\d{7,14}$/.test(normalizePhone(value));
export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value ? value.trim() : '');
