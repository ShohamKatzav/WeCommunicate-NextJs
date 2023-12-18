'use server'

import { cookies } from 'next/headers'
import User from '../types/user'
import ChatUser from '../types/chatUser';

export async function create(data: User): Promise<any> {
  await cookies().set({
    name: 'user',
    value: JSON.stringify({ email: data.email, token: data.token }),
    httpOnly: true
  });
}

export async function get(): Promise<any> {
  return await cookies().get('user');
}

export async function del(): Promise<any> {
  await cookies().set('user', "");
}

export async function createChatUsersList(data: ChatUser[]): Promise<any> {
  await cookies().set({
    name: 'chatUsersList',
    value: JSON.stringify(data),
    httpOnly: true
  });
}

export async function getChatUsersList(): Promise<any> {
  return await cookies().get('chatUsersList');
}