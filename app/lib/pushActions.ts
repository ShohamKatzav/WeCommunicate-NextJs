'use server'
import connectDB from '@/app/lib/MongoDb';
import PushSubscription from '@/models/PushSubscription';
import Message from '@/types/message';
import AccountRepository from '@/repositories/AccountRepository';
import ConversationRepository from '@/repositories/ConversationRepository';
import { IAccount } from '@/models/Account';
import { AsShortName } from "@/app/utils/stringFormat"
import { extractUsersEmailFromCoockie } from '@/app/lib/cookieActions';
import { sendPushToEmails } from '@/services/PushService';


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