'use server';
import { cookies } from 'next/headers'
import User from '../types/user'
import ChatUser from '../types/chatUser';
import jwt from 'jsonwebtoken';

const jwtSecretKey = process.env.TOKEN_SECRET;
if (!jwtSecretKey) {
  throw new Error("TOKEN_SECRET environment variable is not set");
}

interface DecodedToken {
  _id: string;
  email: string;
  signInTime: number;
  iat: number;
}

export async function create(data: User): Promise<any> {
  const cookieStore = await cookies();
  cookieStore.set({
    name: 'user',
    value: JSON.stringify({ email: data.email, token: data.token }),
    httpOnly: true
  });
}

export const fetchUser = async (): Promise<User> => {
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

export async function extractID(): Promise<any> {
  if (!jwtSecretKey) {
    throw new Error("TOKEN_SECRET environment variable is not set");
  }
  const cookieStore = await cookies();
  const userCookie = await cookieStore.get('user');
  if (!userCookie) return null;
  try {
    const userObj = JSON.parse(userCookie.value);
    const decoded = jwt.verify(userObj.token, jwtSecretKey) as DecodedToken;
    return decoded._id || null;
  } catch {
    return null;
  }
}

export async function del(): Promise<any> {
  const cookieStore = await cookies();
  cookieStore.set('user', "");
}

export async function createCoockieChatUsersList(data: ChatUser[]): Promise<any> {
  const cookieStore = await cookies();
  cookieStore.set({
    name: 'chatUsersList',
    value: JSON.stringify(data),
    httpOnly: true
  });
}

export async function getCoockieChatUsersList(): Promise<any> {
  const cookieStore = await cookies();
  return cookieStore.get('chatUsersList');
}