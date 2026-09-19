"use server"
import { del } from '@vercel/blob';
import connectDB from '@/app/lib/MongoDb';
import FileModel from '@/models/FileModel';
import { extractUsersEmailFromCoockie } from '@/app/lib/cookieActions';

export const deleteFile = async (url: string) => {
    try {
        const requesterEmail = await extractUsersEmailFromCoockie();
        if (!requesterEmail) {
            return JSON.parse(JSON.stringify({ error: 'Unauthorized', status: 401 }));
        }

        await connectDB();
        // A file only gets a FileModel document once it's attached to a sent
        // message (see MessageRepository.SaveMessage). Refusing to delete
        // anything that already has one stops any authenticated user from
        // destroying another sender's already-delivered attachment - this
        // action is only meant for cleaning up a file staged for an
        // in-progress, not-yet-sent message.
        const attachedToMessage = await FileModel.exists({ url });
        if (attachedToMessage) {
            return JSON.parse(JSON.stringify({ error: 'Forbidden', status: 403 }));
        }

        await del(url);
        const result = JSON.parse(JSON.stringify({ message: 'success', status: 204 }))
        return result;
    }
    catch {
        const result = JSON.parse(JSON.stringify({ error: 'Internal Server Error', status: 500 }))
        return result;
    }
}
