'use server'
import jwt from 'jsonwebtoken';
import connectDB from '@/app/lib/MongoDb';
import PushSubscription from '@/models/PushSubscription';
import Message from '@/types/message';
import AccountRepository from '@/repositories/AccountRepository';
import ConversationRepository from '@/repositories/ConversationRepository';
import { IAccount } from '@/models/Account';
import { AsShortName } from "@/app/utils/stringFormat"
import { extractUsersEmailFromCoockie, getUserObJFromCoockie } from '@/app/lib/cookieActions';
import { sendPushToEmails } from '@/services/PushService';


// The subscription is always tied to whoever is actually logged in - never to
// a client-supplied email - otherwise anyone could register a subscription
// under someone else's address and read their notifications. Its expiry is
// the session's, so a session that just runs out stops notifying too.
async function currentSession(): Promise<{ email: string; expiresAt: Date } | null> {
    const email = await extractUsersEmailFromCoockie();
    if (!email) return null;
    // extractUsersEmailFromCoockie has already verified this token.
    const { token } = await getUserObJFromCoockie();
    const { exp } = jwt.decode(token!) as { exp?: number };
    return exp ? { email, expiresAt: new Date(exp * 1000) } : null;
}

// Only ever called when this user chose to turn notifications on.
export async function subscribeUser(sub: PushSubscriptionJSON) {
    const session = await currentSession();
    // Also keeps a query operator out of the takeover below, where it would
    // match every other user's rows.
    if (!session || typeof sub?.endpoint !== 'string') return { success: false };

    await connectDB();
    // An endpoint is one browser, and a browser has one logged-in user at a
    // time - whoever held it before and never logged out here must stop
    // being notified on it.
    await PushSubscription.deleteMany({ 'data.endpoint': sub.endpoint, email: { $ne: session.email } });
    await PushSubscription.findOneAndUpdate(
        { email: session.email, 'data.endpoint': sub.endpoint },
        { email: session.email, data: sub, expiresAt: session.expiresAt },
        { upsert: true, new: true }
    );
    return { success: true }
}

// Checked on every app load for the subscription the browser already holds.
// It is kept only if this user opted in to it themselves: anyone else's row
// on it - a previous user whose session ended without logging out here - is
// dropped, and `registered: false` tells the caller to drop the subscription
// too, so this user gets asked instead of silently inheriting it.
export async function syncSubscription(endpoint: string): Promise<{ success: boolean; registered?: boolean }> {
    const session = await currentSession();
    if (!session || typeof endpoint !== 'string') return { success: false };

    await connectDB();
    const rows = await PushSubscription.find({ 'data.endpoint': endpoint })
        .select('email expiresAt')
        .lean() as unknown as { _id: unknown; email: string; expiresAt?: Date }[];
    const others = rows.filter(row => row.email !== session.email);
    if (others.length > 0) {
        await PushSubscription.deleteMany({ _id: { $in: others.map(row => row._id) } });
    }
    const own = rows.find(row => row.email === session.email);
    if (!own) return { success: true, registered: false };
    // Only written when it changed - a new login, or a row from before
    // expiresAt existed - not on every page load.
    if (own.expiresAt?.getTime() !== session.expiresAt.getTime()) {
        await PushSubscription.updateOne({ _id: own._id }, { $set: { expiresAt: session.expiresAt } });
    }
    return { success: true, registered: true };
}

export async function sendNotification(message: Message) {

    try {
        const requesterEmail = await extractUsersEmailFromCoockie();
        if (!requesterEmail) {
            return { success: false, error: 'Unauthorized' };
        }
        // Only the actual sender of the message may trigger a push for it,
        // and only to members of the conversation it belongs to - otherwise
        // any logged-in user could push arbitrary text to anyone as them.
        if (message.sender?.toLowerCase() !== requesterEmail.toLowerCase()) {
            return { success: false, error: 'Unauthorized' };
        }

        await connectDB();

        if (message.conversationID) {
            const conversation = await ConversationRepository.GetConversationById(message.conversationID);
            const isMember = conversation?.members?.some(
                (member: any) => member.email?.toLowerCase() === requesterEmail.toLowerCase()
            );
            if (!isMember) {
                return { success: false, error: 'Unauthorized' };
            }
        }

        const users = await AccountRepository.getUsersByID(message.participantID!) as IAccount[];
        const notificationPayload = {
            title: 'New Message from WeCommunicate',
            body: message.text ? AsShortName(message.sender) + ": " + message.text :
                message.location ? AsShortName(message.sender) + " has shared a location" :
                    AsShortName(message.sender) + " has sent you a file",
        };
        const successCount = await sendPushToEmails(
            users.flatMap(user => user.email ? [user.email] : []),
            notificationPayload
        );
        return { success: successCount > 0 };
    } catch (error) {
        console.error('Error sending push notification:', error)
        return { success: false, error: 'Failed to send notification' }
    }
}