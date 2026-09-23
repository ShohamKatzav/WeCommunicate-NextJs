import webpush from 'web-push'
import { env } from '@/app/config/env';
import connectDB from '@/app/lib/MongoDb';
import PushSubscription, { IPushSubscription } from '@/models/PushSubscription';

webpush.setVapidDetails(
    `mailto:${env.SMTP_USER}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    env.VAPID_PRIVATE_KEY!
)

export interface PushPayload {
    title: string;
    body: string;
    icon?: string;
}

// Delivery only - callers decide who may notify whom. Kept out of
// app/lib/pushActions.ts because every export of a 'use server' file is a
// client-callable action, and this takes arbitrary recipient emails.
export async function sendPushToEmails(emails: string[], payload: PushPayload): Promise<number> {
    await connectDB();
    // Both Account.email and PushSubscription.email are always stored
    // lowercased already, so a plain $in match is correct - no need to
    // build a regex out of these values (a regex per-email is also a
    // ReDoS/injection surface, and "+"-addressed emails like
    // a+b@gmail.com break as a regex quantifier).
    const normalized = emails.flatMap(email => email ? [email.trim().toLowerCase()] : []);
    if (normalized.length === 0) return 0;

    const subscriptions = await PushSubscription.find({
        email: { $in: normalized }
    }).lean() as unknown as IPushSubscription[];

    let successCount = 0;
    for (const sub of subscriptions) {
        try {
            await webpush.sendNotification(
                sub.data as webpush.PushSubscription,
                JSON.stringify({ icon: '/icon.png', ...payload })
            );
            successCount++;
        } catch (error: any) {
            // We'll delete stale object - like when browser data deleted it'll return 410
            if (error.statusCode === 410 || error.statusCode === 404) {
                await PushSubscription.deleteOne({ _id: sub._id });
            }
        }
    }
    return successCount;
}
