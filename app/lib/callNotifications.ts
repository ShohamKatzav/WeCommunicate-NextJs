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

export function refreshOwnPushEndpoint(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return Promise.resolve();
    return navigator.serviceWorker.getRegistration()
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
let pendingAnswer: { callId: string; at: number; voiceOnly: boolean } | null = null;
// CallController, for a call that was already ringing when the answer came.
const pendingAnswerListeners = new Set<() => void>();

export function answerOnArrival(callId: string, voiceOnly = false) {
    pendingAnswer = { callId, at: Date.now(), voiceOnly };
    pendingAnswerListeners.forEach(listener => listener());
}

export function onPendingAnswer(listener: () => void) {
    pendingAnswerListeners.add(listener);
    return () => {
        pendingAnswerListeners.delete(listener);
    };
}

// The Answer button on the ring notification (public/service-worker.js). It
// doesn't say whether the call is video, so a device without a camera always
// answers with voice only - a voice call is unaffected, and a video call
// would otherwise fail to open a camera and decline itself.
export async function answerFromNotification(callId: string) {
    const [hasCamera] = await Promise.all([
        navigator.mediaDevices?.enumerateDevices()
            .then(devices => devices.some(device => device.kind === 'videoinput'))
            .catch(() => true) ?? true,
        // The answer goes out right away here, not seconds after the ring,
        // so the endpoint that keeps the "answered elsewhere" push off this
        // device has to be in hand first.
        refreshOwnPushEndpoint(),
    ]);
    answerOnArrival(callId, !hasCamera);
}

// A window the notification opened carries the answer in its URL - taken out
// again so it doesn't linger in the address bar and history.
export function takeAnswerFromUrl() {
    const url = new URL(window.location.href);
    const callId = url.searchParams.get('answer');
    if (!callId) return null;
    url.searchParams.delete('answer');
    window.history.replaceState(window.history.state, '', url);
    return callId;
}

export function takePendingAnswer(callId: string): { voiceOnly: boolean } | null {
    const pending = pendingAnswer;
    if (!pending || pending.callId !== callId) return null;
    pendingAnswer = null;
    if (Date.now() - pending.at >= ANSWER_HANDOFF_MS) return null;
    return { voiceOnly: pending.voiceOnly };
}
