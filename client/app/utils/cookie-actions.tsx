'use server'
 
import { cookies } from 'next/headers'
import User from '../types/user'
 
export async function create(data : User) : Promise<any> {
  await cookies().set({
    name: 'user',
    value: JSON.stringify({ email: data.email, token: data.token }),
    httpOnly: true
  });
}

export async function get() : Promise<any> {
  const cookieStore = cookies()
  const user = await cookieStore.get('user');
  return user;
}

export async function del() : Promise<any> {
  const cookieStore = cookies()
  await cookieStore.set('user',"");
}
