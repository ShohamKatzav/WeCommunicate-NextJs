'use server';
import { env } from '@/app/config/env';
import { cookies } from 'next/headers';
import User from '@/types/user';
import jwt from 'jsonwebtoken';

interface DecodedToken {
  _id: string;
  email: string;
  signInTime: number;
  iat: number;
}

export async function createUserCoockie(data: User): Promise<any> {
  const cookieStore = await cookies();
  cookieStore.set({
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    name: 'user',
    value: JSON.stringify({ email: data.email, token: data.token }),
  });
}

export const fetchgetUserObJFromCoockie = async (): Promise<User> => {
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
    const user = await fetchgetUserObJFromCoockie();
    if (!user) return null;
    const decoded = jwt.verify(user.token as string, env.JWT_SECRET_KEY) as unknown as DecodedToken;
    return decoded._id || null;
  } catch {
    throw new Error("Failed retrieving users ID");
  }
}

export async function extractUsersEmailFromCoockie(): Promise<any> {
  try {
    const user = await fetchgetUserObJFromCoockie();
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