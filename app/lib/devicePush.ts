import urlBase64ToUint8Array from '@/app/utils/urlBase64ToUint8Array';
import { subscribeUser, syncSubscription } from '@/app/lib/pushActions';

// The account that last turned notifications on here. Logging out drops the
// subscription (and its server row) but keeps this, so that account logging
// back in gets its notifications back without being asked - while anyone
// else still has to opt in: they'd see their own message previews on the
// lock screen without ever having tapped Enable. Only the account id is
// kept, not the email, so a shared device doesn't show who used it.
const OWNER_KEY = 'push:owner';

function readOwner(): string | null {
    try { return localStorage.getItem(OWNER_KEY); } catch { return null; }
}

function rememberOwner(accountId: string | null) {
    if (!accountId) return;
    try { localStorage.setItem(OWNER_KEY, accountId); } catch { }
}

// Unverified, which is fine here: it only decides whether to ask first. The
// server still ties the subscription to whoever the cookie says.
function accountIdOf(token: string): string | null {
    try {
        const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(payload))._id ?? null;
    } catch {
        return null;
    }
}

export async function getDeviceSubscription(): Promise<PushSubscription | null> {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker || !('PushManager' in window)) return null;
    const registration = await navigator.serviceWorker.getRegistration();
    return (await registration?.pushManager.getSubscription()) ?? null;
}

async function register(subscription: PushSubscription, token: string): Promise<void> {
    const { success } = await subscribeUser(subscription.toJSON());
    if (!success) {
        // A subscription nothing sends to would also hide the soft-ask for good.
        await subscription.unsubscribe().catch(() => { });
        throw new Error("The server didn't register the subscription");
    }
    rememberOwner(accountIdOf(token));
}

// Asks for permission if it hasn't been granted yet (so, from a tap), then
// subscribes this device for the logged-in user.
export async function enableDevicePush(token: string): Promise<PushSubscription> {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
    });
    await register(subscription, token);
    return subscription;
}

// Once per login, on whichever page it starts (UserProvider), and shared, so
// PushNotificationManager can wait for it before deciding whether to ask.
let sync: { token: string; done: Promise<void> } | null = null;

export function syncDeviceSubscription(token: string): Promise<void> {
    if (sync?.token !== token) sync = { token, done: runSync(token) };
    return sync.done;
}

async function runSync(token: string): Promise<void> {
    // A failed check is retried by the next caller for this login.
    const retryLater = () => { if (sync?.token === token) sync = null; };
    const isOwner = accountIdOf(token) !== null && readOwner() === accountIdOf(token);
    try {
        const subscription = await getDeviceSubscription();
        if (!subscription) {
            // Back after logging out here. Anything failing (a browser that
            // won't subscribe outside a tap) just leaves the soft-ask up.
            if (isOwner && Notification.permission === 'granted') await enableDevicePush(token);
            return;
        }
        const { success, registered } = await syncSubscription(subscription.endpoint);
        if (!success) return retryLater();
        if (registered) {
            // Also adopts subscriptions made before the owner was recorded.
            rememberOwner(accountIdOf(token));
        } else if (isOwner) {
            // This account's own session ran out without a logout, and its
            // row expired with it.
            await register(subscription, token);
        } else {
            // Left behind by someone else - this user hasn't opted in.
            await subscription.unsubscribe();
        }
    } catch (error) {
        // Offline, most likely - keep what the browser has, check next time.
        console.error('Failed to sync push subscription:', error);
        retryLater();
    }
}
