'use server';
import { env } from '@/app/config/env';
import { SESSION_MAX_AGE_SECONDS } from '@/app/config/session';
import PushSubscription from '@/models/PushSubscription';
import { cookies } from 'next/headers';
import User from '@/types/user';
import jwt from 'jsonwebtoken';
import connectDB from '@/app/lib/MongoDb';
import AccountRepository from '@/repositories/AccountRepository';
import { Types } from 'mongoose';

interface DecodedToken {
  _id: string;
  email: string;
  isModerator: boolean;
  signInTime: number;
  iat: number;
}

export async function createUserCoockie(data: User): Promise<any> {
  const cookieStore = await cookies();
  let isModerator = false;
  if (data.token) {
    try {
      const decoded = jwt.verify(data.token, env.JWT_SECRET_KEY) as DecodedToken;
      isModerator = decoded.isModerator || false;
    } catch (err) {
      console.error("Failed to decode token:", err);
    }
  }

  cookieStore.set({
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_SECONDS,
    name: 'user',
    value: JSON.stringify({
      email: data.email,
      nickname: data.nickname,
      token: data.token,
      isModerator,
      avatarUrl: data.avatarUrl,
      accentColor: data.accentColor
    }),
  });
}

export const getUserObJFromCoockie = async (): Promise<User> => {
  let user: User = {};
  try {
    const cookieStore = await cookies();
    const userString = await cookieStore.get('user');
    if (userString?.value.trim()) {
      user = JSON.parse(userString!.value);
      return user;
    } else {
      //console.error("No user data found in cookies");
    }
  } catch (error) {
    console.error("Error fetching user data:", error);
  } finally {
    return user;
  }
}

// The cookie is per-device and only rewritten on login or a local profile
// edit, so a nickname/avatar/accent change made on another device would stay
// stale here forever (and the old avatar blob is deleted on change, so the
// stale URL 404s). Overlay those display fields from the DB on every load.
// Done inside the same server action as the cookie read on purpose - see
// userProvider.tsx; a second mount-time action can cause a spurious remount.
export const getCurrentUser = async (): Promise<User> => {
  const user = await getUserObJFromCoockie();
  if (!user.token) return user;
  try {
    const decoded = jwt.verify(user.token, env.JWT_SECRET_KEY) as DecodedToken;
    await connectDB();
    const profile = await AccountRepository.getProfileByIdentifier(decoded._id) as
      { email?: string; nickname?: string; avatarUrl?: string; accentColor?: string } | null;
    if (!profile) return user;
    return {
      ...user,
      // The cookie's email isn't signed - show the account's, not whatever
      // the cookie claims.
      email: profile.email ?? user.email,
      nickname: profile.nickname,
      avatarUrl: profile.avatarUrl || undefined,
      accentColor: profile.accentColor,
    };
  } catch (error) {
    // Fall back to the cookie's copy - stale display fields beat no user.
    console.error("Failed to refresh user profile:", error);
    return user;
  }
}

export async function extractUserIDFromCoockie(): Promise<any> {
  try {
    const user = await getUserObJFromCoockie();
    if (!user) return null;
    const decoded = jwt.verify(user.token as string, env.JWT_SECRET_KEY) as unknown as DecodedToken;
    return decoded._id || null;
  } catch {
    throw new Error("Failed retrieving users ID");
  }
}

// The cookie's own `email` field is never read here: only the token is
// signed, and the rest of the cookie is whatever the browser sends - a valid
// token next to someone else's email would otherwise act as them. The email
// comes from the account the verified token points to, same identity sends
// and reactions use (and the one kept current by an email change).
// Returns null instead of throwing, so callers' `if (!email)` checks turn a
// missing/invalid cookie into their normal unauthorized response.
export async function extractUsersEmailFromCoockie(): Promise<string | null> {
  try {
    const user = await getUserObJFromCoockie();
    if (!user.token) return null;
    const decoded = jwt.verify(user.token, env.JWT_SECRET_KEY) as unknown as DecodedToken;
    if (!decoded._id || !Types.ObjectId.isValid(decoded._id)) return null;
    await connectDB();
    return await AccountRepository.getEmailById(new Types.ObjectId(decoded._id)) || null;
  }
  catch {
    return null;
  }
}

// Given this device's push endpoint, it also stops notifying this user on it.
// Done in the same request because finding their row needs the cookie that's
// about to go - a separate action first would add a round trip to logout.
// Best-effort: logging out must never fail on it.
export async function deleteUserCoockie(pushEndpoint?: string): Promise<any> {
  if (typeof pushEndpoint === 'string') {
    try {
      const email = await extractUsersEmailFromCoockie();
      if (email) await PushSubscription.deleteOne({ email, 'data.endpoint': pushEndpoint });
    } catch (error) {
      console.error("Failed to remove push subscription:", error);
    }
  }
  const cookieStore = await cookies();
  // .set('user', "") with none of the original attributes (httpOnly,
  // secure, sameSite, path) can create a distinct cookie rather than
  // clearing the original one. .delete() is the correct way to actually
  // remove it.
  cookieStore.delete('user');
}
