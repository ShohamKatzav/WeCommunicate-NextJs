'use client';
import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Phone, PhoneOff, RotateCcw, SwitchCamera, Video, VideoOff, X } from 'lucide-react';
import Avatar from '../ui/avatar';
import { AsShortName } from '../../utils/stringFormat';
import { CallController, CallSnapshot } from '../../lib/callController';
import useMediaDeviceAvailability from '../../hooks/useMediaDeviceAvailability';
import { unavailableDevicesReason } from '../../lib/mediaDeviceError';
import { formatCallDuration } from '../../utils/callRecord';
import { useT } from '../../i18n/client';

interface CallOverlayProps {
    call: CallSnapshot;
    controller: CallController | null;
}

// srcObject only - a MediaStream never goes through a blob: URL, so the CSP
// media-src needs nothing new for calls.
const StreamVideo = ({ stream, className }: { stream: MediaStream | null; className: string }) => {
    const ref = useRef<HTMLVideoElement>(null);
    useEffect(() => {
        const element = ref.current;
        if (!element) return;
        element.srcObject = stream;
        return () => {
            element.srcObject = null;
        };
    }, [stream]);
    // Always muted: remote audio plays through the single <audio> element
    // below, and the self-view must never echo your own mic.
    return <video ref={ref} autoPlay playsInline muted className={className} />;
};

const RemoteAudio = ({ stream }: { stream: MediaStream | null }) => {
    const ref = useRef<HTMLAudioElement>(null);
    useEffect(() => {
        const element = ref.current;
        if (!element) return;
        element.srcObject = stream;
        return () => {
            element.srcObject = null;
        };
    }, [stream]);
    return <audio ref={ref} autoPlay className="hidden" />;
};

const useElapsedSeconds = (connectedAt: number | null, running: boolean) => {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!connectedAt || !running) return;
        // `now` may predate connectedAt until the first tick - clamped to 0 below.
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, [connectedAt, running]);
    return connectedAt ? Math.max(0, Math.floor((now - connectedAt) / 1000)) : 0;
};

const FOCUS_RING = 'outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900';

const ControlButton = ({ label, onClick, active = false, danger = false, children }: {
    label: string;
    onClick: () => void;
    active?: boolean;
    danger?: boolean;
    children: React.ReactNode;
}) => (
    <button
        type="button"
        onClick={onClick}
        aria-label={label}
        title={label}
        className={`flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full transition-colors ${FOCUS_RING} ${danger
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : active
                ? 'bg-white text-gray-900 hover:bg-gray-200'
                : 'bg-white/15 text-white hover:bg-white/25'
            }`}
    >
        {children}
    </button>
);

const CallOverlay = ({ call, controller }: CallOverlayProps) => {
    const elapsed = useElapsedSeconds(call.connectedAt, call.status === 'connected' || call.status === 'reconnecting');
    // Voice calls need a microphone; video calls need a microphone and a
    // camera (see getMedia(true, video) in callController.ts). Accepting
    // without one of them would otherwise fail from here: accept() catches
    // the getUserMedia rejection, auto-declines, and the caller just sees
    // "declined". Checked here so the incoming card can name the device
    // that is actually missing.
    const devices = useMediaDeviceAvailability();
    const t = useT();

    if (call.status === 'idle' || !call.peer || !controller) return null;

    const name = call.peer.nickname || AsShortName(call.peer.email);
    const unavailableReason = unavailableDevicesReason({ audio: true, video: call.video }, devices, t);
    // A video call with a microphone but no camera can still be answered;
    // only a missing microphone leaves decline as the only action.
    const voiceOnly = call.video && !devices.hasCamera && devices.hasMicrophone;

    if (call.status === 'incoming') {
        return (
            <div
                role="dialog"
                aria-modal="false"
                aria-labelledby="incoming-call-name"
                aria-describedby="incoming-call-kind"
                // Below the navbar rather than over it - the navbar sits in
                // its own stacking context, so no z-index here can lift the
                // card above it.
                className="fixed start-1/2 top-[calc(var(--navbar-height)+0.75rem)] z-60 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 rtl:translate-x-1/2 rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-gray-700 dark:bg-gray-800"
            >
                <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                        <span className="absolute inset-0 animate-ping rounded-full bg-green-400/40" aria-hidden="true" />
                        <Avatar avatarUrl={call.peer.avatarUrl} nickname={call.peer.nickname} email={call.peer.email} size={48} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p id="incoming-call-name" className="truncate font-semibold text-gray-900 dark:text-white">{name}</p>
                        <p id="incoming-call-kind" aria-live="assertive" className="text-sm text-gray-500 dark:text-gray-400">
                            {call.video ? t("calls.incomingVideo") : t("calls.incomingVoice")}
                        </p>
                    </div>
                </div>
                {voiceOnly && (
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                        {t("calls.noCamera")}
                    </p>
                )}
                {unavailableReason && !voiceOnly && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                        {t("calls.canStillDecline", { reason: unavailableReason })}
                    </p>
                )}
                <div className="mt-4 flex gap-3">
                    <button
                        type="button"
                        onClick={() => controller.decline()}
                        aria-label={t("calls.declineFrom", { name })}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-red-700 ${FOCUS_RING} dark:focus-visible:ring-offset-gray-800 focus-visible:ring-offset-white`}
                    >
                        <PhoneOff size={18} aria-hidden="true" />
                        {t("calls.decline")}
                    </button>
                    {voiceOnly ? (
                        <button
                            type="button"
                            onClick={() => controller.accept({ video: false })}
                            aria-label={t("calls.voiceOnlyFrom", { name })}
                            className={`flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-green-700 ${FOCUS_RING} dark:focus-visible:ring-offset-gray-800 focus-visible:ring-offset-white`}
                        >
                            <Phone size={18} aria-hidden="true" />
                            {t("calls.voiceOnly")}
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => controller.accept()}
                            disabled={!!unavailableReason}
                            aria-label={unavailableReason
                                ? t("calls.cantAccept", { reason: unavailableReason.charAt(0).toLocaleLowerCase(t.dateLocale) + unavailableReason.slice(1) })
                                : call.video ? t("calls.acceptVideoFrom", { name }) : t("calls.acceptVoiceFrom", { name })}
                            className={`flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-green-600 ${FOCUS_RING} dark:focus-visible:ring-offset-gray-800 focus-visible:ring-offset-white`}
                        >
                            {call.video ? <Video size={18} aria-hidden="true" /> : <Phone size={18} aria-hidden="true" />}
                            {t("calls.accept")}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    const inCall = call.status === 'connecting' || call.status === 'connected' || call.status === 'reconnecting';
    const showRemoteVideo = inCall && call.remoteVideoOn;
    const showSelfView = (inCall || call.status === 'outgoing') && call.cameraOn && !!call.localStream;

    const statusText = {
        outgoing: t("calls.ringing"),
        connecting: t("calls.connecting"),
        connected: formatCallDuration(elapsed),
        reconnecting: t("calls.reconnecting"),
        failed: call.message || t("calls.failed"),
        ended: call.message || t("calls.ended"),
    }[call.status];

    return (
        <section
            role="dialog"
            aria-label={call.video ? t("calls.videoCallWith", { name }) : t("calls.voiceCallWith", { name })}
            className="absolute inset-0 z-20 flex flex-col bg-gray-950 text-white"
        >
            <RemoteAudio stream={inCall ? call.remoteStream : null} />

            <div className="relative min-h-0 flex-1 overflow-hidden">
                {showRemoteVideo && (
                    <StreamVideo stream={call.remoteStream} className="absolute inset-0 h-full w-full bg-black object-contain" />
                )}

                {showRemoteVideo ? (
                    <div className="absolute start-3 top-3 max-w-[70%] rounded-lg bg-black/50 px-3 py-1.5">
                        <p className="truncate text-sm font-semibold">{name}</p>
                        <p className="text-xs text-gray-200 tabular-nums" aria-live="polite">{statusText}</p>
                    </div>
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                        <Avatar avatarUrl={call.peer.avatarUrl} nickname={call.peer.nickname} email={call.peer.email} size={112} />
                        <p className="max-w-full truncate text-xl font-semibold">{name}</p>
                        <p
                            className={`text-sm tabular-nums ${call.status === 'failed' ? 'max-w-xs text-red-300' : 'text-gray-300'}`}
                            aria-live="polite"
                        >
                            {statusText}
                        </p>
                    </div>
                )}

                {showSelfView && (
                    <StreamVideo
                        stream={call.localStream}
                        className="absolute bottom-3 end-3 aspect-3/4 w-24 -scale-x-100 rounded-xl border border-white/20 bg-gray-800 object-cover shadow-lg sm:aspect-video sm:w-44"
                    />
                )}
            </div>

            <div className="flex shrink-0 items-center justify-center gap-3 bg-gray-900/90 p-4 sm:gap-4">
                {(inCall || call.status === 'outgoing') && (
                    <>
                        <ControlButton
                            label={call.micMuted ? t("calls.unmute") : t("calls.mute")}
                            onClick={() => controller.toggleMute()}
                            active={call.micMuted}
                        >
                            {call.micMuted ? <MicOff size={22} aria-hidden="true" /> : <Mic size={22} aria-hidden="true" />}
                        </ControlButton>
                        <ControlButton
                            label={call.cameraOn ? t("calls.cameraOff") : t("calls.cameraOn")}
                            onClick={() => controller.toggleCamera()}
                            active={!call.cameraOn}
                        >
                            {call.cameraOn ? <Video size={22} aria-hidden="true" /> : <VideoOff size={22} aria-hidden="true" />}
                        </ControlButton>
                        {call.cameraOn && call.canSwitchCamera && (
                            <ControlButton label={t("calls.switchCamera")} onClick={() => controller.switchCamera()}>
                                <SwitchCamera size={22} aria-hidden="true" />
                            </ControlButton>
                        )}
                        <ControlButton label={call.status === 'outgoing' ? t("calls.cancel") : t("calls.hangUp")} onClick={() => controller.hangUp()} danger>
                            <PhoneOff size={22} aria-hidden="true" />
                        </ControlButton>
                    </>
                )}

                {call.status === 'failed' && (
                    <>
                        <ControlButton label={t("calls.retry")} onClick={() => controller.retry()}>
                            <RotateCcw size={22} aria-hidden="true" />
                        </ControlButton>
                        <ControlButton label={t("calls.close")} onClick={() => controller.dismiss()} danger>
                            <X size={22} aria-hidden="true" />
                        </ControlButton>
                    </>
                )}

                {call.status === 'ended' && (
                    <ControlButton label={t("calls.close")} onClick={() => controller.dismiss()}>
                        <X size={22} aria-hidden="true" />
                    </ControlButton>
                )}
            </div>
        </section>
    );
};

export default CallOverlay;
