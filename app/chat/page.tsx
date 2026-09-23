import { env } from '@/app/config/env'
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Types } from 'mongoose';
import connectDB from "@/app/lib/MongoDb";
import ConversationRepository from "@/repositories/ConversationRepository";
import { getUsernames } from '@/app/lib/accountActions';
import { getBlockedUserIds } from '@/app/lib/blockActions';
import { getIceServers } from '@/app/lib/iceServers';
import User from '@/types/user';
import jwt from 'jsonwebtoken';
import ChatClient from './chatClient';
import DecodedToken from '@/types/decodedToken';

export default async function ChatPage() {

    const initialUsers = await getUsernames();
    const initialConversationsWithMessages = await getConversations(env.NEXT_PUBLIC_MESSAGES_PER_PAGE);
    const blockedResult = await getBlockedUserIds();

    return (
        <ChatClient
            initialUsers={initialUsers}
            initialConversationsWithMessages={initialConversationsWithMessages}
            initialBlockedUserIds={blockedResult.blockedIds}
            iceServers={getIceServers()}
        />
    );
}

export async function getConversations(numOfMessages: number) {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get("user");

    // proxy.ts already gates /chat behind a valid session, but that depends
    // on its matcher staying in sync with this route - a share landing here
    // (or any other request) with no/invalid session must go back to login
    // instead of throwing into the framework's default error page.
    if (!userCookie) redirect('/login');

    let user: User;
    try {
        user = JSON.parse(userCookie.value);
    } catch {
        user = { token: userCookie.value };
    }
    if (!user.token) return;

    let decoded: DecodedToken;
    try {
        decoded = jwt.verify(user.token as string, env.JWT_SECRET_KEY as string) as unknown as DecodedToken;
    } catch {
        redirect('/login');
    }
    await connectDB();

    const recentConversations = await ConversationRepository.GetRecentConversations(
        new Types.ObjectId(decoded._id), numOfMessages || env.NEXT_PUBLIC_MESSAGES_PER_PAGE || 5
    );
    const conversationsJson = JSON.parse(JSON.stringify(recentConversations));
    return conversationsJson;
}
