// Must match INCOMING_CALL_TAG in public/service-worker.js.
const INCOMING_CALL_TAG = 'incoming-call';

// The ring notification from a call push stays in the shade (and, on
// desktop, on screen) until something closes it - once the call is answered,
// declined or gone in the app, it's no longer true.
export function closeIncomingCallNotifications() {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
    navigator.serviceWorker.getRegistration()
        .then(registration => registration?.getNotifications({ tag: INCOMING_CALL_TAG }))
        .then(notifications => notifications?.forEach(notification => notification.close()))
        .catch(() => { });
}

// This browser's push subscription endpoint, sent along with an answer or
// decline so the server can clear the ring on the user's *other* devices
// without also buzzing this one. Read ahead of time (refreshed on every
// invite) because the answer itself shouldn't wait on it.
let ownPushEndpoint: string | undefined;

export function refreshOwnPushEndpoint() {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
    navigator.serviceWorker.getRegistration()
        .then(registration => registration?.pushManager.getSubscription())
        .then(subscription => {
            ownPushEndpoint = subscription?.endpoint;
        })
        .catch(() => { });
}

export const getOwnPushEndpoint = () => ownPushEndpoint;

// Answering from IncomingCallNotice (any page but the chat) navigates to the
// chat, whose CallController picks the call up with 'call sync' and answers
// it straight away instead of making the user tap Accept a second time.
const ANSWER_HANDOFF_MS = 20_000;
let pendingAnswer: { callId: string; at: number } | null = null;

export function answerOnArrival(callId: string) {
    pendingAnswer = { callId, at: Date.now() };
}

export function takePendingAnswer(callId: string) {
    const pending = pendingAnswer;
    if (!pending || pending.callId !== callId) return false;
    pendingAnswer = null;
    return Date.now() - pending.at < ANSWER_HANDOFF_MS;
}
