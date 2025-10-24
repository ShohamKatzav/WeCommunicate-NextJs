'use server';
import { cookies } from 'next/headers'
import User from '../types/user'
import ChatUser from '../types/chatUser';


export async function create(data: User): Promise<any> {
  const cookieStore = await cookies();
  cookieStore.set({
    name: 'user',
    value: JSON.stringify({ email: data.email, token: data.token }),
    httpOnly: true
  });
}

export async function get(): Promise<any> {
  const cookieStore = await cookies();
  return cookieStore.get('user');
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