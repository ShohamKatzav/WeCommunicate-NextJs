'use server'
import webpush from 'web-push'
import { env } from '@/app/config/env';
import connectDB from '@/app/lib/MongoDb';
import PushSubscription from '@/models/PushSubscription';
import Message from '@/types/message';
import AccountRepository from '@/repositories/AccountRepository';
import { IAccount } from '@/models/Account';
import { IPushSubscription } from "@/models/PushSubscription";
import { AsShortName } from "@/app/utils/stringFormat"

webpush.setVapidDetails(
    `mailto:${env.SMTP_USER}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    env.VAPID_PRIVATE_KEY!
)


export async function subscribeUser(sub: PushSubscription, email: string) {
    await connectDB();
    await PushSubscription.findOneAndUpdate(
        { email, 'data.endpoint': sub.endpoint },
        { email, data: sub },
        { upsert: true, new: true }
    );
    return { success: true }
}

export async function unsubscribeUser(email: string) {
    await connectDB();
    await PushSubscription.deleteMany({ email });
    return { success: true }
}

export async function sendNotification(message: Message) {

    try {
        await connectDB();
        const users = await AccountRepository.getUsersByID(message.participantID!) as IAccount[];
        const emails = users.map(user => user.email);
        const emailSearchConditions = emails.map(email => ({
            email: {
                $regex: `^${email}$`,
                $options: 'i'
            }
        }));
        const subscriptions = await PushSubscription.find({
            $or: emailSearchConditions
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