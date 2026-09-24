"use server"
import { env } from '@/app/config/env';
import { SESSION_MAX_AGE_SECONDS } from '@/app/config/session';
import connectDB from "@/app/lib/MongoDb";
import AccountRepository from "@/repositories/AccountRepository";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import ModerationService from '@/services/ModerationService';
import { isEmail, isPhone, normalizePhone } from './contact';
import { findAccount } from './accountHelpers';
import RedisService from '@/services/RedisService';
import { isTestBypass } from './testBypass';

export const isExist = async (identifier: string) => { await connectDB(); const user = await findAccount(identifier); return { accountExists: Boolean(user), status: user ? 200 : 401 }; };
export const createUser = async (identifier: string, password: string, nickname: string) => {
  if (!password || !nickname.trim() || (!isEmail(identifier) && !isPhone(identifier))) return { message: 'A valid email or phone number, nickname, and password are required', status: 400 };
  try {
    await connectDB(); if (await findAccount(identifier)) return { message: `An account already exists for this ${isPhone(identifier) ? 'phone number' : 'email address'}`, status: 409 };
    const phone = isPhone(identifier) ? normalizePhone(identifier) : undefined;
    // Realtime messaging uses email as its internal key; phone-only accounts get a private stable key.
    const email = phone ? `phone:${phone}` : identifier.trim().toLowerCase();
    const accountId = await AccountRepository.addUser(email, await bcrypt.hash(password, 10), nickname.trim(), phone);
    const token = jwt.sign({ _id: accountId.toString(), email, nickname: nickname.trim(), isModerator: false, signInTime: Date.now() }, env.JWT_SECRET_KEY!, { expiresIn: SESSION_MAX_AGE_SECONDS });
    return { success: true, token, email, nickname: nickname.trim(), isModerator: false, status: 201 };
  } catch (err) { console.error('Failed to create user:', err); return { message: 'Internal Server Error', status: 500 }; }
};
export const authenticateUser = async (identifier: string, password: string) => {
  if (!identifier || !password) return { message: 'Email or phone number and password are required', status: 400 };
  try {
    if (!(await isTestBypass())) {
      // Without this, login is an unthrottled password-guessing oracle
      // against any known email/phone - 10 attempts per 15 minutes per
      // identifier.
      const allowed = await RedisService.checkRateLimit('login', identifier, 10, 900);
      if (!allowed) return { message: 'Too many login attempts. Please try again in a few minutes.', status: 429 };
    }

    await connectDB(); const user = await findAccount(identifier); if (!user) return { message: 'User not found', status: 404 };
    const banStatus = await ModerationService.isUserBanned(user._id.toString());
    if (banStatus.isBanned) return { message: `Your account has been banned. Reason: ${banStatus.reason ?? 'Policy violation'}`, status: 403 };
    if (!await bcrypt.compare(password, user.password)) return { message: 'Invalid password', status: 401 };
    const token = jwt.sign({ _id: user._id, email: user.email, nickname: user.nickname, isModerator: user.isModerator || false, signInTime: Date.now() }, env.JWT_SECRET_KEY!, { expiresIn: SESSION_MAX_AGE_SECONDS });
    return { success: true, token, email: user.email, nickname: user.nickname, isModerator: user.isModerator || false, avatarUrl: user.avatarUrl, accentColor: user.accentColor, status: 200 };
  } catch (err) { console.error('Failed to authenticate user:', err); return { message: 'Internal Server Error', status: 500 }; }
};
export const getUsernames = async () => { await connectDB(); return JSON.parse(JSON.stringify(await AccountRepository.getUsernames())); };
