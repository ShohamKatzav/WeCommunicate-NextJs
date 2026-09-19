'use server'
import webpush from 'web-push'
import { env } from '@/app/config/env';
import connectDB from '@/app/lib/MongoDb';
import PushSubscription from '@/models/PushSubscription';
import Message from '@/types/message';
import AccountRepository from '@/repositories/AccountRepository';
import ConversationRepository from '@/repositories/ConversationRepository';
import { IAccount } from '@/models/Account';
import { IPushSubscription } from "@/models/PushSubscription";
import { AsShortName } from "@/app/utils/stringFormat"
import { extractUsersEmailFromCoockie } from '@/app/lib/cookieActions';

webpush.setVapidDetails(
    `mailto:${env.SMTP_USER}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    env.VAPID_PRIVATE_KEY!
)


export async function subscribeUser(sub: PushSubscription) {
    // The subscription is always tied to whoever is actually logged in -
    // never to a client-supplied email - otherwise anyone could register a
    // subscription under someone else's address and read their notifications.
    const email = await extractUsersEmailFromCoockie();
    if (!email) return { success: false };

    await connectDB();
    await PushSubscription.findOneAndUpdate(
        { email, 'data.endpoint': sub.endpoint },
        { email, data: sub },
        { upsert: true, new: true }
    );
    return { success: true }
}

export async function unsubscribeUser() {
    const email = await extractUsersEmailFromCoockie();
    if (!email) return { success: false };

    await connectDB();
    await PushSubscription.deleteMany({ email });
    return { success: true }
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
        // Both Account.email and PushSubscription.email are always stored
        // lowercased already, so a plain $in match is correct - no need to
        // build a regex out of these values (a regex per-email is also a
        // ReDoS/injection surface, and "+"-addressed emails like
        // a+b@gmail.com break as a regex quantifier).
        const emails = users.map(user => user.email?.trim().toLowerCase());
        const subscriptions = await PushSubscription.find({
            email: { $in: emails }
        }).lean() as unknown as IPushSubscription[];
        if (!subscriptions) {
            throw new Error('No subscription available')
        }
        let successCount = 0;
        const notificationPayload = {
            title: 'New Message from WeCommunicate',
            body: message.text ? AsShortName(message.sender) + ": " + message.text :
                AsShortName(message.sender) + " has sent you a file",
            icon: '/icon.png',
        };
        for (const sub of subscriptions) {
            try {
                await webpush.sendNotification(
                    sub.data as webpush.PushSubscription,
                    JSON.stringify(notificationPayload)
                );
                successCount++;
            } catch (error: any) {
                // We'll delete stale object - like when browser data deleted it'll return 410
                if (error.statusCode === 410 || error.statusCode === 404) {
                    await PushSubscription.deleteOne({ _id: sub._id });
                }
            }
        }
        return { success: successCount > 0 };
    } catch (error) {
        console.error('Error sending push notification:', error)
        return { success: false, error: 'Failed to send notification' }
    }
}