'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { toast } from 'sonner';
import Avatar from '../ui/avatar';
import { useSocket } from '../../hooks/useSocket';
import { AsShortName } from '../../utils/stringFormat';
import { answerOnArrival, closeIncomingCallNotifications, getOwnPushEndpoint, refreshOwnPushEndpoint } from '../../lib/callNotifications';
import useMediaDeviceAvailability from '../../hooks/useMediaDeviceAvailability';
import { unavailableDevicesReason } from '../../lib/mediaDeviceError';
import { useT } from '../../i18n/client';

interface Invite {
    callId: string;
    conversationId: string;
    video: boolean;
    from: string;
    fromName?: string;
}

interface CancelPayload {
    callId?: string;
    reason?: string;
}

// The server ends an unanswered call at 30s and says so; this only covers a
// server that lost the call mid-ring.
const RING_TIMEOUT_MS = 35_000;

const FOCUS_RING = 'outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-800';

const isChatPath = (pathname: string | null) => pathname === '/chat' || !!pathname?.startsWith('/chat/');

// Calls themselves live on the chat page (CallController), but the socket is
// connected on every page - without this, a call to someone on their profile
// or the map reached a socket nobody was listening on, and since they were
// "online" no push went out either. This only rings and hands off: Answer
// opens the chat, which picks the call up with 'call sync' and answers it.
const IncomingCallNotice = () => {
    // Read from a ref inside the socket effect below, so switching language
    // mid-ring doesn't tear down the listeners and the ring timer.
    const t = useT();
    const tRef = useRef(t);
    useEffect(() => { tRef.current = t; });
    const { socket } = useSocket();
    const pathname = usePathname();
    const router = useRouter();
    const devices = useMediaDeviceAvailability();
    const [invite, setInvite] = useState<Invite | null>(null);
    // Read by socket listeners, which outlive any one render.
    const inviteRef = useRef<Invite | null>(null);
    const ringRef = useRef<HTMLAudioElement | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const active = !!socket && !isChatPath(pathname);

    const clear = () => {
        inviteRef.current = null;
        ringRef.current?.pause();
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
        setInvite(null);
    };

    useEffect(() => {
        if (!socket || !active) return;

        const onInvite = (data: Invite) => {
            if (!data?.callId || !data.conversationId || !data.from) return;
            const current = inviteRef.current;
            if (current && current.callId !== data.callId) return;
            inviteRef.current = data;
            setInvite(data);
            // A re-sent invite ('call sync') for the call already ringing.
            if (current) return;
            refreshOwnPushEndpoint();
            if (!ringRef.current) {
                ringRef.current = new Audio('/sounds/ring.wav');
                ringRef.current.loop = true;
                ringRef.current.volume = 0.5;
            }
            ringRef.current.currentTime = 0;
            // Autoplay can refuse before the user has interacted with the
            // page - the card is still on screen either way.
            ringRef.current.play().catch(() => { });
            timeoutRef.current = setTimeout(clear, RING_TIMEOUT_MS);
        };

        const onCancel = (data: CancelPayload) => {
            const missed = inviteRef.current;
            if (!missed || data?.callId !== missed.callId) return;
            clear();
            closeIncomingCallNotifications();
            if (data.reason === 'answered-elsewhere' || data.reason === 'declined-elsewhere') return;
            toast(tRef.current("calls.missedFrom", { name: missed.fromName || AsShortName(missed.from) }));
        };

        // A call that started ringing while this socket was down (a frozen
        // background tab, a reconnect) - same as CallController does.
        const onConnect = () => socket.emit('call sync');

        socket.on('call invite', onInvite);
        socket.on('call cancel', onCancel);
        socket.on('connect', onConnect);
        if (socket.connected) onConnect();

        return () => {
            socket.off('call invite', onInvite);
            socket.off('call cancel', onCancel);
            socket.off('connect', onConnect);
            // Leaving for the chat page hands the ring to CallController,
            // which re-syncs the invite on mount - nothing is declined here.
            clear();
        };
    }, [socket, active]);

    if (!active || !invite) return null;

    const name = invite.fromName || AsShortName(invite.from);
    const ids = { callId: invite.callId, conversationId: invite.conversationId };

    const decline = () => {
        socket?.emit('call decline', { ...ids, pushEndpoint: getOwnPushEndpoint() });
        clear();
        closeIncomingCallNotifications();
    };

    const answer = (voiceOnly = false) => {
        clear();
        closeIncomingCallNotifications();
        answerOnArrival(invite.callId, voiceOnly);
        router.push('/chat');
    };

    // Same rules as CallOverlay's incoming card: a video call can still be
    // answered without a camera, but nothing can be answered without a
    // microphone - Answer would open the chat only for the call to fail
    // and auto-decline there.
    const voiceOnly = invite.video && !devices.hasCamera && devices.hasMicrophone;
    const unavailableReason = voiceOnly ? null : unavailableDevicesReason({ audio: true, video: invite.video }, devices, t);

    return (
        <div
            role="dialog"
            aria-modal="false"
            aria-labelledby="incoming-call-notice-name"
            aria-describedby="incoming-call-notice-kind"
            // Same placement as CallOverlay's incoming card.
            className="fixed start-1/2 top-[calc(var(--navbar-height)+0.75rem)] z-60 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 rtl:translate-x-1/2 rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-gray-700 dark:bg-gray-800"
        >
            <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                    <span className="absolute inset-0 animate-ping rounded-full bg-green-400/40" aria-hidden="true" />
                    <Avatar nickname={invite.fromName} email={invite.from} size={48} />
                </div>
                <div className="min-w-0 flex-1">
                    <p id="incoming-call-notice-name" className="truncate font-semibold text-gray-900 dark:text-white">{name}</p>
                    <p id="incoming-call-notice-kind" aria-live="assertive" className="text-sm text-gray-500 dark:text-gray-400">
                        {invite.video ? t("calls.incomingVideo") : t("calls.incomingVoice")}
                    </p>
                </div>
            </div>
            {voiceOnly && (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                    {t("calls.noCamera")}
                </p>
            )}
            {unavailableReason && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                    {t("calls.canStillDecline", { reason: unavailableReason })}
                </p>
            )}
            <div className="mt-4 flex gap-3">
                <button
                    type="button"
                    onClick={decline}
                    aria-label={t("calls.declineFrom", { name })}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-red-700 ${FOCUS_RING}`}
                >
                    <PhoneOff size={18} aria-hidden="true" />
                    {t("calls.decline")}
                </button>
                {voiceOnly ? (
                    <button
                        type="button"
                        onClick={() => answer(true)}
                        aria-label={t("calls.voiceOnlyFrom", { name })}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-green-700 ${FOCUS_RING}`}
                    >
                        <Phone size={18} aria-hidden="true" />
                        {t("calls.voiceOnly")}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() => answer(false)}
                        disabled={!!unavailableReason}
                        aria-label={unavailableReason
                            ? t("calls.cantAnswer", { reason: unavailableReason.charAt(0).toLocaleLowerCase(t.dateLocale) + unavailableReason.slice(1) })
                            : invite.video ? t("calls.answerVideoFrom", { name }) : t("calls.answerVoiceFrom", { name })}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-green-600 ${FOCUS_RING}`}
                    >
                        {invite.video ? <Video size={18} aria-hidden="true" /> : <Phone size={18} aria-hidden="true" />}
                        {t("calls.answer")}
                    </button>
                )}
            </div>
        </div>
    );
};

export default IncomingCallNotice;
