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
import { setLocaleCookie } from '@/app/i18n/server';
import { isLocale } from '@/app/i18n/config';

interface DecodedToken {
  _id: string;
  email: string;
  isModerator: boolean;
  signInTime: number;
  iat: number;
}

// Not exported, so no client can call it: isModerator here always comes from
// the server - the token's claim or a fresh account read.
async function writeUserCookie(data: User, isModerator: boolean) {
  const cookieStore = await cookies();
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

// data.isModerator is ignored: a tab can't grant itself the flag. A new
// token (login) takes the claim it was signed with. The same token again
// (a profile edit re-saving the user) keeps the cookie's current flag,
// which getCurrentUser may have corrected from the account since login -
// the token's claim is as old as the session.
export async function createUserCoockie(data: User): Promise<any> {
  let isModerator = false;
  if (data.token) {
    try {
      const decoded = jwt.verify(data.token, env.JWT_SECRET_KEY) as DecodedToken;
      const current = await getUserObJFromCoockie();
      isModerator = current.token === data.token && typeof current.isModerator === 'boolean'
        ? current.isModerator
        : decoded.isModerator || false;
    } catch (err) {
      console.error("Failed to decode token:", err);
    }
  }

  await writeUserCookie(data, isModerator);

  // The account's language wins over whatever this device had picked
  // anonymously. An account that never chose one leaves the device's choice
  // alone - it would otherwise flip every existing Hebrew-browser user to
  // English on their next login.
  if (isLocale(data.locale)) await setLocaleCookie(data.locale);
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
// isModerator comes from the same read: the token's claim is from login, so
// a promotion or demotion since then would otherwise wait for the next one.
// It only drives the UI (the Moderator links, /moderator's redirect) -
// moderator actions check the account themselves.
export const getCurrentUser = async (): Promise<User> => {
  const user = await getUserObJFromCoockie();
  if (!user.token) return user;
  try {
    const decoded = jwt.verify(user.token, env.JWT_SECRET_KEY) as DecodedToken;
    await connectDB();
    const profile = await AccountRepository.getSessionProfileById(decoded._id);
    if (!profile) return user;
    const isModerator = profile.isModerator === true;
    // Only when it changed: setting a cookie from a server action re-renders
    // the page, which every load shouldn't pay for.
    if (user.isModerator !== isModerator) await writeUserCookie(user, isModerator);
    return {
      ...user,
      // The cookie's email isn't signed - show the account's, not whatever
      // the cookie claims.
      email: profile.email ?? user.email,
      nickname: profile.nickname,
      avatarUrl: profile.avatarUrl || undefined,
      accentColor: profile.accentColor,
      locale: isLocale(profile.locale) ? profile.locale : undefined,
      isModerator,
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

// The footer's language picker, for signed-out visitors as much as anyone.
// A signed-in account gets the choice saved too: login copies the account's
// language over the cookie, so a cookie-only change would be undone on the
// next sign-in. Setting the cookie re-renders the page in the new language.
export async function setMyLocale(locale: string): Promise<{ success: boolean }> {
  if (!isLocale(locale)) return { success: false };
  await setLocaleCookie(locale);
  try {
    const user = await getUserObJFromCoockie();
    if (!user.token) return { success: true };
    const decoded = jwt.verify(user.token, env.JWT_SECRET_KEY) as unknown as DecodedToken;
    if (!decoded._id || !Types.ObjectId.isValid(decoded._id)) return { success: true };
    await connectDB();
    await AccountRepository.updateProfile(decoded._id, { locale });
  } catch (error) {
    // This device still switched; only the account copy is missing.
    console.error("Failed to save locale to account:", error);
  }
  return { success: true };
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
