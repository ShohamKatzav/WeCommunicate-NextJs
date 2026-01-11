'use server';
import { env } from '@/app/config/env';
import { cookies } from 'next/headers';
import User from '@/types/user';
import jwt from 'jsonwebtoken';

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
    maxAge: 60 * 60 * 24 * 7,
    name: 'user',
    value: JSON.stringify({
      email: data.email,
      token: data.token,
      isModerator
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

export async function extractUsersEmailFromCoockie(): Promise<any> {
  try {
    const user = await getUserObJFromCoockie();
    if (!user) return null;
    return user.email;
  }
  catch {
    throw new Error("Failed retrieving users email");
  }
}

export async function deleteUserCoockie(): Promise<any> {
  const cookieStore = await cookies();
  cookieStore.set('user', "");
}