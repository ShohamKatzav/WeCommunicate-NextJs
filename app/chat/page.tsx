import { cookies } from 'next/headers';
import { Types } from 'mongoose';
import connectDB from "@/app/lib/MongoDb";
import ConversationRepository from "@/repositories/ConversationRepository";
import { getUsernames } from '@/app/lib/accountActions';
import User from '@/types/user';
import jwt from 'jsonwebtoken';
import ChatClient from './chatClient';
import DecodedToken from '@/types/decodedToken';


const jwtSecretKey = process.env.TOKEN_SECRET;
if (!jwtSecretKey) {
    throw new Error("TOKEN_SECRET environment variable is not set");
}

export default async function ChatPage() {

    const initialUsers = await getUsernames();
    const initialConversationsWithMessages = await getConversations(process.env.NEXT_PUBLIC_MESSAGES_PER_PAGE);

    return (
        <ChatClient
            initialUsers={initialUsers}
            initialConversationsWithMessages={initialConversationsWithMessages}
        />
    );
}

export async function getConversations(numOfMessages: string = '') {
    const cookieStore = await cookies();
    const userCookie = await cookieStore.get("user");

    if (!userCookie) throw new Error("Missing user cookie");

    let user: User;
    try {
        user = JSON.parse(userCookie.value);
    } catch {
        user = { token: userCookie.value };
    }

    const decoded = jwt.verify(user.token as string, jwtSecretKey as string) as unknown as DecodedToken;
    await connectDB();

    const recentConversations = await ConversationRepository.GetRecentConversations(
        new Types.ObjectId(decoded._id), parseInt(numOfMessages || process.env.NEXT_PUBLIC_MESSAGES_PER_PAGE || '5')
    );
    const conversationsJson = JSON.parse(JSON.stringify(recentConversations));
    return conversationsJson;
}
