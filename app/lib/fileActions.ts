"use server"
import { del } from '@vercel/blob';

export const deleteFile = async (url: string) => {
    try {
        await del(url);
        const result = JSON.parse(JSON.stringify({ message: 'success', status: 204 }))
        return result;
    }
    catch {
        const result = JSON.parse(JSON.stringify({ error: 'Internal Server Error', status: 500 }))
        return result;
    }
}