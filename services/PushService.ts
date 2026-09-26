import webpush from 'web-push'
import { env } from '@/app/config/env';
import connectDB from '@/app/lib/MongoDb';
import PushSubscription, { IPushSubscription } from '@/models/PushSubscription';
import Account from '@/models/Account';
import { SESSION_MAX_AGE_SECONDS } from '@/app/config/session';

webpush.setVapidDetails(
    `mailto:${env.SMTP_USER}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    env.VAPID_PRIVATE_KEY!
)

export interface PushPayload {
    title: string;
    body: string;
    icon?: string;
    // Picks the notification style in the service worker's push handler
    // (public/service-worker.js) and the delivery options below.
    kind?: 'message' | 'call' | 'missed-call' | 'call-handled';
}

interface SendOptions {
    // The device that caused this push (e.g. answered the call) - it
    // already knows.
    exceptEndpoint?: string;
}

// All the call kinds share a Topic, so a push service still holding an
// undelivered ring (a phone in Doze) swaps it for whatever replaced it
// instead of delivering both.
const CALL_TOPIC = 'incoming-call';

const DELIVERY_OPTIONS: Partial<Record<NonNullable<PushPayload['kind']>, webpush.RequestOptions>> = {
    call: {
        // Matches CALL_RING_TIMEOUT_MS - a ring that can't be delivered
        // while the call is still ringing is dropped rather than arriving late.
        TTL: 30,
        // High urgency is what lets the push service wake a dozing phone
        // right away (FCM high priority on Android).
        urgency: 'high',
        topic: CALL_TOPIC,
    },
    'missed-call': {
        TTL: 24 * 60 * 60,
        topic: CALL_TOPIC,
    },
    // Only replaces a ring - pointless once any ring would have expired.
    'call-handled': {
        TTL: 60,
        topic: CALL_TOPIC,
    },
};

// Rows saved before expiresAt existed. No session alive now can outlast
// SESSION_MAX_AGE_SECONDS, and a device still in use restamps its row with
// its session's real expiry on the next app load (syncSubscription).
let legacyExpiryBackfill: Promise<unknown> | null = null;
function backfillLegacyExpiry() {
    legacyExpiryBackfill ??= PushSubscription.updateMany(
        { expiresAt: { $exists: false } },
        { $set: { expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000) } }
    ).catch(error => {
        legacyExpiryBackfill = null;
        console.error('Failed to backfill push subscription expiry:', error);
    });
    return legacyExpiryBackfill;
}

// Delivery only - callers decide who may notify whom. Kept out of
// app/lib/pushActions.ts because every export of a 'use server' file is a
// client-callable action, and this takes arbitrary recipient emails.
export async function sendPushToEmails(emails: string[], payload: PushPayload, { exceptEndpoint }: SendOptions = {}): Promise<number> {
    await connectDB();
    await backfillLegacyExpiry();
    // Both Account.email and PushSubscription.email are always stored
    // lowercased already, so a plain $in match is correct - no need to
    // build a regex out of these values (a regex per-email is also a
    // ReDoS/injection surface, and "+"-addressed emails like
    // a+b@gmail.com break as a regex quantifier).
    const normalized = emails.flatMap(email => email ? [email.trim().toLowerCase()] : []);
    if (normalized.length === 0) return 0;

    // Checked here rather than by deleting rows when an account is banned,
    // so every ban path is covered: the 'banned' socket event only logs out
    // devices connected right now, and a phone with the app closed would
    // keep being notified. A temp ban that has run out no longer counts,
    // even before isUserBanned gets around to clearing it.
    const now = new Date();
    const banned: string[] = await Account.distinct('email', {
        email: { $in: normalized },
        isBanned: true,
        $or: [{ bannedUntil: null }, { bannedUntil: { $gt: now } }]
    });
    const recipients = normalized.filter(email => !banned.includes(email));
    if (recipients.length === 0) return 0;

    const subscriptions = await PushSubscription.find({
        email: { $in: recipients },
        expiresAt: { $gt: now }
    }).lean() as unknown as IPushSubscription[];

    const options = payload.kind ? DELIVERY_OPTIONS[payload.kind] : undefined;
    let successCount = 0;
    // One line per push, so "the phone showed nothing" can be told apart from
    // "nothing was sent" in the server log. Only the push service's host is
    // logged - the full endpoint is what lets anyone push to that device.
    const results: string[] = [];
    for (const sub of subscriptions) {
        const endpoint = (sub.data as { endpoint?: string }).endpoint;
        if (exceptEndpoint && endpoint === exceptEndpoint) continue;
        const host = pushServiceHost(endpoint);
        try {
            const { statusCode } = await webpush.sendNotification(
                sub.data as webpush.PushSubscription,
                JSON.stringify({ icon: '/icon.png', ...payload }),
                options
            );
            successCount++;
            results.push(`${host} ${statusCode}`);
        } catch (error: any) {
            // We'll delete stale object - like when browser data deleted it'll return 410
            const gone = error.statusCode === 410 || error.statusCode === 404;
            if (gone) {
                await PushSubscription.deleteOne({ _id: sub._id });
            }
            const reason = error.statusCode
                ? `${error.statusCode} ${String(error.body ?? '').replace(/\s+/g, ' ').slice(0, 200)}`
                : String(error.message ?? error);
            results.push(`${host} failed: ${reason.trim()}${gone ? ' (removed)' : ''}`);
        }
    }
    const summary = results.length > 0 ? results.join(', ')
        : subscriptions.length > 0 ? 'no device besides the one that caused it'
            : 'no live subscription';
    console.log(`Push ${payload.kind ?? 'message'}: ${summary}`);
    return successCount;
}

function pushServiceHost(endpoint: string | undefined) {
    try {
        return new URL(endpoint!).host;
    } catch {
        return 'invalid endpoint';
    }
}
