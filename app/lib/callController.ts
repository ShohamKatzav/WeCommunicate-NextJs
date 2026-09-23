import { Socket } from 'socket.io-client';
import type { IceServerConfig } from './iceServers';
import { describeMediaError } from './mediaDeviceError';

// Client side of 1:1 calls. Media is a single RTCPeerConnection between the
// two browsers; the socket only carries the ringing events and the SDP/ICE
// relay (see the call handlers at the bottom of socket/handlers.js).
//
// A plain class rather than hook state: RTCPeerConnection callbacks and
// socket listeners fire outside React, and every one of them needs the
// current call, not whatever a render closed over. The React side
// (app/hooks/useCall.ts) only subscribes to snapshots.

export type CallStatus =
    | 'idle'
    | 'outgoing'
    | 'incoming'
    | 'connecting'
    | 'connected'
    | 'reconnecting'
    | 'failed'
    | 'ended';

export interface CallPeer {
    email: string;
    nickname?: string;
    avatarUrl?: string;
}

export interface CallSnapshot {
    status: CallStatus;
    peer: CallPeer | null;
    conversationId: string | null;
    // Whether the call was started as a video call (labels only - the camera
    // can be switched on or off at any point).
    video: boolean;
    message: string | null;
    connectedAt: number | null;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    remoteVideoOn: boolean;
    micMuted: boolean;
    cameraOn: boolean;
    canSwitchCamera: boolean;
}

export interface CallControllerHooks {
    getIceServers: () => IceServerConfig[];
    resolvePeer: (email: string) => CallPeer;
    getCurrentConversationId: () => string;
    // Brings the call's conversation on screen when a call is answered from
    // somewhere else (another conversation, or the chat list).
    openConversation: (conversationId: string, peerEmail: string) => Promise<void>;
    onError: (message: string) => void;
    // An incoming call that stopped ringing before it was answered - a
    // passing notice, not a screen over whatever the user was doing.
    onMissedCall: (peer: CallPeer) => void;
}

interface CallIds {
    callId: string;
    conversationId: string;
}

interface InvitePayload extends CallIds {
    video: boolean;
    from: string;
}

interface EndPayload extends CallIds {
    reason?: string;
}

interface SignalPayload extends CallIds {
    description?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
}

interface Session extends CallIds {
    peer: CallPeer;
    direction: 'outgoing' | 'incoming';
    video: boolean;
    polite: boolean;
    pc: RTCPeerConnection | null;
    localStream: MediaStream | null;
    remoteStream: MediaStream;
    localTracksAttached: boolean;
    // Perfect negotiation state (https://w3c.github.io/webrtc-pc/#perfect-negotiation-example).
    makingOffer: boolean;
    ignoreOffer: boolean;
    isSettingRemoteAnswerPending: boolean;
    // Incoming signals are applied one at a time - otherwise a candidate can
    // reach addIceCandidate while the offer it belongs to is still inside
    // setRemoteDescription.
    signalQueue: Promise<void>;
    iceRestartAttempted: boolean;
    // The conversation that was open when this call became "this
    // conversation's call" - leaving it hangs up.
    anchorConversationId: string | null;
    timers: Set<ReturnType<typeof setTimeout>>;
}

const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
};

const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
    width: { ideal: 1280, max: 1280 },
    height: { ideal: 720, max: 720 },
    frameRate: { ideal: 30, max: 30 },
    facingMode: 'user',
};

const MAX_VIDEO_BITRATE = 900_000;
// The server ends an unanswered call at 30s and tells both sides; these only
// cover a server that lost the call (e.g. restarted mid-ring).
const RING_TIMEOUT_MS = 35_000;
const CONNECT_TIMEOUT_MS = 30_000;
// 'disconnected' often recovers on its own within a second or two (a brief
// wifi hiccup) - only restart ICE if it hasn't.
const ICE_RESTART_DELAY_MS = 2_500;
const RECONNECT_TIMEOUT_MS = 15_000;
const ENDED_DISPLAY_MS = 2_500;

const ACTIVE_STATUSES: CallStatus[] = ['outgoing', 'connecting', 'connected', 'reconnecting'];

const IDLE_SNAPSHOT: CallSnapshot = {
    status: 'idle',
    peer: null,
    conversationId: null,
    video: false,
    message: null,
    connectedAt: null,
    localStream: null,
    remoteStream: null,
    remoteVideoOn: false,
    micMuted: false,
    cameraOn: false,
    canSwitchCamera: false,
};

export const IDLE_CALL_SNAPSHOT = IDLE_SNAPSHOT;

const END_MESSAGES: Record<string, string> = {
    'no-answer': 'No answer',
    offline: 'Unavailable',
    unavailable: 'Unavailable',
    busy: 'Busy on another call',
    declined: 'Call declined',
    cancelled: 'Missed call',
    missed: 'Missed call',
    disconnected: 'Connection lost',
    hangup: 'Call ended',
    ended: 'Call ended',
    replaced: 'Call ended',
};

async function getMedia(audio: boolean, video: boolean): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) {
        throw new DOMException('Calls need a secure (https) page', 'SecurityError');
    }
    try {
        return await navigator.mediaDevices.getUserMedia({
            audio: audio ? AUDIO_CONSTRAINTS : false,
            video: video ? VIDEO_CONSTRAINTS : false,
        });
    } catch (error) {
        // Some cameras reject the `max` caps outright - retry with just the
        // ideal size rather than failing the whole call.
        if (video && error instanceof DOMException && error.name === 'OverconstrainedError') {
            return navigator.mediaDevices.getUserMedia({
                audio: audio ? AUDIO_CONSTRAINTS : false,
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
            });
        }
        throw error;
    }
}

function stopStream(stream: MediaStream | null) {
    stream?.getTracks().forEach(track => track.stop());
}

export class CallController {
    private socket: Socket;
    private userEmail: string;
    private hooks: CallControllerHooks;
    private session: Session | null = null;
    private snapshot: CallSnapshot = IDLE_SNAPSHOT;
    private listeners = new Set<() => void>();
    private ring: HTMLAudioElement | null = null;
    private endedTimer: ReturnType<typeof setTimeout> | null = null;
    // Set while getUserMedia is pending for a new outgoing call, so a
    // double click (or a permission prompt left open) can't start two.
    private starting = false;
    private lastCall: { peer: CallPeer; conversationId: string; video: boolean } | null = null;
    private destroyed = false;

    constructor(socket: Socket, userEmail: string, hooks: CallControllerHooks) {
        this.socket = socket;
        this.userEmail = userEmail.toLowerCase();
        this.hooks = hooks;

        socket.on('call invite', this.onInvite);
        socket.on('call accept', this.onAccept);
        socket.on('call decline', this.onDecline);
        socket.on('call cancel', this.onCancel);
        socket.on('call hangup', this.onHangup);
        socket.on('call busy', this.onBusy);
        socket.on('call unavailable', this.onUnavailable);
        socket.on('call signal', this.onSignal);
        socket.on('connect', this.onSocketConnect);

        // Picks up a call that started ringing before this page was open
        // (e.g. opened from the incoming-call push).
        if (socket.connected) socket.emit('call sync');
    }

    // ---- React bridge ----------------------------------------------------

    subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    getSnapshot = () => this.snapshot;

    private update(patch: Partial<CallSnapshot>) {
        this.snapshot = { ...this.snapshot, ...patch };
        this.listeners.forEach(listener => listener());
    }

    // ---- Public actions --------------------------------------------------

    async startCall(peer: CallPeer, conversationId: string, video: boolean) {
        if (this.destroyed || this.starting || !conversationId) return;
        if (!this.socket.connected) {
            this.hooks.onError("You're offline - calls need a connection.");
            return;
        }
        // One call at a time: a new one hangs up whatever was going on.
        if (this.session) this.hangUp();
        this.clearEndedTimer();

        this.starting = true;
        let stream: MediaStream;
        try {
            stream = await getMedia(true, video);
        } catch (error) {
            this.hooks.onError(await describeMediaError(error, { audio: true, video }));
            return;
        } finally {
            this.starting = false;
        }
        // Unmounted, or another call took over, while the permission prompt
        // was open.
        if (this.destroyed || this.session) {
            stopStream(stream);
            return;
        }

        const session = this.createSession({
            callId: crypto.randomUUID(),
            conversationId,
            peer,
            direction: 'outgoing',
            video,
        });
        session.localStream = stream;
        session.anchorConversationId = this.hooks.getCurrentConversationId() || conversationId;
        this.session = session;
        this.lastCall = { peer, conversationId, video };

        this.update({
            ...IDLE_SNAPSHOT,
            status: 'outgoing',
            peer,
            conversationId,
            video,
            localStream: stream,
            cameraOn: video,
        });
        this.refreshCameraCount();

        this.socket.emit('call invite', { callId: session.callId, conversationId, video });
        this.startRing();
        this.setSessionTimer(session, () => this.finish('ended', END_MESSAGES['no-answer'], 'call cancel'), RING_TIMEOUT_MS);
    }

    async accept() {
        const session = this.session;
        if (!session || session.direction !== 'incoming' || this.snapshot.status !== 'incoming') return;
        this.stopRing();
        this.clearSessionTimers(session);

        let stream: MediaStream;
        try {
            stream = await getMedia(true, session.video);
        } catch (error) {
            this.hooks.onError(await describeMediaError(error, { audio: true, video: session.video }));
            // Never leave a half-open call - the caller hears a decline.
            if (this.session === session) this.finish('idle', null, 'call decline');
            return;
        }
        // The caller gave up (or the call was taken elsewhere) while the
        // permission prompt was open.
        if (this.session !== session) {
            stopStream(stream);
            return;
        }

        session.localStream = stream;
        this.lastCall = { peer: session.peer, conversationId: session.conversationId, video: session.video };
        this.update({
            status: 'connecting',
            localStream: stream,
            cameraOn: session.video,
        });
        this.refreshCameraCount();

        // Tracks are attached when the caller's offer arrives (see
        // handleSignal), so they reuse the offer's transceivers instead of
        // both sides offering at once.
        this.createPeerConnection(session);
        this.socket.emit('call accept', { callId: session.callId, conversationId: session.conversationId });
        this.setSessionTimer(session, () => this.failConnect(session), CONNECT_TIMEOUT_MS);

        if (this.hooks.getCurrentConversationId() !== session.conversationId) {
            try {
                await this.hooks.openConversation(session.conversationId, session.peer.email);
            } catch {
                // The call works without the conversation on screen.
            }
        }
        if (this.session === session) {
            session.anchorConversationId = this.hooks.getCurrentConversationId() || session.conversationId;
        }
    }

    decline() {
        if (!this.session || this.snapshot.status !== 'incoming') return;
        this.finish('idle', null, 'call decline');
    }

    // Ends whatever is going on, with the event that matches the state.
    hangUp() {
        const session = this.session;
        if (!session) {
            // Failed/ended screens have no live call behind them.
            this.dismiss();
            return;
        }
        switch (this.snapshot.status) {
            case 'incoming':
                this.finish('idle', null, 'call decline');
                break;
            case 'outgoing':
                this.finish('idle', null, 'call cancel');
                break;
            default:
                this.finish('ended', END_MESSAGES.hangup, 'call hangup');
        }
    }

    dismiss() {
        if (this.session) return;
        this.clearEndedTimer();
        this.update(IDLE_SNAPSHOT);
    }

    retry() {
        if (this.snapshot.status !== 'failed' || !this.lastCall) return;
        const { peer, conversationId, video } = this.lastCall;
        this.startCall(peer, conversationId, video);
    }

    toggleMute() {
        const track = this.session?.localStream?.getAudioTracks()[0];
        if (!track) return;
        track.enabled = !track.enabled;
        this.update({ micMuted: !track.enabled });
    }

    async toggleCamera() {
        const session = this.session;
        if (!session?.localStream) return;
        if (this.snapshot.cameraOn) {
            this.turnCameraOff(session);
            return;
        }

        let stream: MediaStream;
        try {
            stream = await getMedia(false, true);
        } catch (error) {
            this.hooks.onError(await describeMediaError(error, { audio: false, video: true }));
            return;
        }
        if (this.session !== session || !session.localStream) {
            stopStream(stream);
            return;
        }
        await this.useVideoTrack(session, stream.getVideoTracks()[0]);
        this.refreshCameraCount();
    }

    async switchCamera() {
        const session = this.session;
        const current = session?.localStream?.getVideoTracks()[0];
        if (!session || !current) return;

        const cameras = (await navigator.mediaDevices.enumerateDevices())
            .filter(device => device.kind === 'videoinput');
        if (cameras.length < 2) return;
        const currentIndex = cameras.findIndex(camera => camera.deviceId === current.getSettings().deviceId);
        const next = cameras[(currentIndex + 1) % cameras.length];

        // Phones generally can't hold two cameras open at once - release the
        // current one before asking for the next.
        current.stop();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { ...VIDEO_CONSTRAINTS, facingMode: undefined, deviceId: { exact: next.deviceId } },
            });
            if (this.session !== session) {
                stopStream(stream);
                return;
            }
            await this.useVideoTrack(session, stream.getVideoTracks()[0]);
        } catch (error) {
            this.hooks.onError(await describeMediaError(error, { audio: false, video: true }));
            if (this.session === session) this.turnCameraOff(session);
        }
    }

    // Leaving the call's conversation hangs up; an incoming call keeps
    // ringing wherever the user goes until they answer it.
    conversationChanged(conversationId: string) {
        const session = this.session;
        if (!session || this.snapshot.status === 'incoming') return;
        if (session.anchorConversationId && conversationId !== session.anchorConversationId) {
            this.hangUp();
        }
    }

    // pagehide: the page may come back from the back/forward cache, so the
    // listeners stay - only the call ends.
    endActiveCall() {
        if (this.session) this.hangUp();
        this.stopRing();
    }

    destroy() {
        this.endActiveCall();
        this.destroyed = true;
        this.clearEndedTimer();
        this.socket.off('call invite', this.onInvite);
        this.socket.off('call accept', this.onAccept);
        this.socket.off('call decline', this.onDecline);
        this.socket.off('call cancel', this.onCancel);
        this.socket.off('call hangup', this.onHangup);
        this.socket.off('call busy', this.onBusy);
        this.socket.off('call unavailable', this.onUnavailable);
        this.socket.off('call signal', this.onSignal);
        this.socket.off('connect', this.onSocketConnect);
        this.listeners.clear();
        this.ring = null;
    }

    // ---- Socket events ---------------------------------------------------

    private isCurrent(data: CallIds | undefined): Session | null {
        const session = this.session;
        if (!session || !data || data.callId !== session.callId) return null;
        return session;
    }

    private onInvite = (data: InvitePayload) => {
        if (this.destroyed || !data?.callId || !data.conversationId || !data.from) return;
        // A re-sent invite ('call sync') for the call already ringing here.
        if (this.session?.callId === data.callId) return;
        // The server already answers "busy" while this account is in a
        // call - this only guards against the two disagreeing.
        if (this.session || this.starting) return;
        this.clearEndedTimer();

        const peer = this.hooks.resolvePeer(data.from);
        const session = this.createSession({
            callId: data.callId,
            conversationId: data.conversationId,
            peer,
            direction: 'incoming',
            video: data.video === true,
        });
        this.session = session;
        this.update({
            ...IDLE_SNAPSHOT,
            status: 'incoming',
            peer,
            conversationId: data.conversationId,
            video: session.video,
        });
        this.startRing();
        this.setSessionTimer(session, () => this.finish('ended', END_MESSAGES.missed, null), RING_TIMEOUT_MS);
    };

    private onAccept = (data: CallIds) => {
        const session = this.isCurrent(data);
        if (!session || session.direction !== 'outgoing' || this.snapshot.status !== 'outgoing') return;
        this.stopRing();
        this.clearSessionTimers(session);
        this.update({ status: 'connecting' });

        const pc = this.createPeerConnection(session);
        // Adding the tracks fires negotiationneeded, which sends the offer.
        this.attachLocalTracks(session, pc);
        this.setSessionTimer(session, () => this.failConnect(session), CONNECT_TIMEOUT_MS);
    };

    private onDecline = (data: CallIds) => {
        if (!this.isCurrent(data)) return;
        this.finish('ended', END_MESSAGES.declined, null);
    };

    private onCancel = (data: EndPayload) => {
        if (!this.isCurrent(data)) return;
        // Answered or declined on another of this user's tabs - nothing to
        // tell them here.
        if (data.reason === 'answered-elsewhere' || data.reason === 'declined-elsewhere') {
            this.finish('idle', null, null);
            return;
        }
        this.finish('ended', END_MESSAGES[data.reason || 'missed'] || END_MESSAGES.missed, null);
    };

    private onHangup = (data: EndPayload) => {
        if (!this.isCurrent(data)) return;
        if (data.reason === 'failed') {
            this.finish('failed', this.failureMessage(), null);
            return;
        }
        this.finish('ended', END_MESSAGES[data.reason || 'hangup'] || END_MESSAGES.hangup, null);
    };

    private onBusy = (data: CallIds) => {
        if (!this.isCurrent(data)) return;
        this.finish('ended', END_MESSAGES.busy, null);
    };

    private onUnavailable = (data: EndPayload) => {
        if (!this.isCurrent(data)) return;
        this.finish('ended', END_MESSAGES[data.reason || 'unavailable'] || END_MESSAGES.unavailable, null);
    };

    private onSignal = (data: SignalPayload) => {
        const session = this.isCurrent(data);
        if (!session || !session.pc) return;
        session.signalQueue = session.signalQueue
            .then(() => this.handleSignal(session, data))
            .catch(() => {
                // Logged in handleSignal; one bad message must not wedge the queue.
            });
    };

    private onSocketConnect = () => {
        // Socket.IO's connection state recovery keeps the same socket id
        // after a short drop, and the server keeps the call bound to it. A
        // fresh socket means the server has let go of this call.
        const session = this.session;
        if (session && !this.socket.recovered && ACTIVE_STATUSES.includes(this.snapshot.status)) {
            this.finish('ended', END_MESSAGES.disconnected, null);
        }
        this.socket.emit('call sync');
    };

    // ---- WebRTC ----------------------------------------------------------

    private createSession(init: Pick<Session, 'callId' | 'conversationId' | 'peer' | 'direction' | 'video'>): Session {
        return {
            ...init,
            // Perfect negotiation needs exactly one polite side; both sides
            // derive the same answer from the two emails.
            polite: this.userEmail > init.peer.email.toLowerCase(),
            pc: null,
            localStream: null,
            remoteStream: new MediaStream(),
            localTracksAttached: false,
            makingOffer: false,
            ignoreOffer: false,
            isSettingRemoteAnswerPending: false,
            signalQueue: Promise.resolve(),
            iceRestartAttempted: false,
            anchorConversationId: null,
            timers: new Set(),
        };
    }

    private createPeerConnection(session: Session): RTCPeerConnection {
        const pc = new RTCPeerConnection({ iceServers: this.hooks.getIceServers() });
        session.pc = pc;

        pc.onnegotiationneeded = async () => {
            if (this.session !== session) return;
            try {
                session.makingOffer = true;
                await pc.setLocalDescription();
                this.sendSignal(session, { description: this.describe(pc.localDescription) });
            } catch (error) {
                console.warn('Call: creating an offer failed', (error as Error)?.name);
            } finally {
                session.makingOffer = false;
            }
        };

        pc.onicecandidate = ({ candidate }) => {
            if (candidate && this.session === session) {
                this.sendSignal(session, { candidate: candidate.toJSON() });
            }
        };

        pc.ontrack = ({ track }) => {
            if (this.session !== session) return;
            if (!session.remoteStream.getTracks().includes(track)) {
                session.remoteStream.addTrack(track);
            }
            track.onmute = () => this.refreshRemoteVideo(session);
            track.onunmute = () => this.refreshRemoteVideo(session);
            track.onended = () => this.refreshRemoteVideo(session);
            // A new MediaStream object, so the <audio>/<video> elements get
            // a fresh srcObject that includes the new track.
            this.update({ remoteStream: new MediaStream(session.remoteStream.getTracks()) });
            this.refreshRemoteVideo(session);
        };

        pc.onconnectionstatechange = () => this.handleConnectionState(session, pc);
        return pc;
    }

    private attachLocalTracks(session: Session, pc: RTCPeerConnection) {
        if (session.localTracksAttached || !session.localStream) return;
        session.localTracksAttached = true;
        for (const track of session.localStream.getTracks()) {
            pc.addTrack(track, session.localStream);
        }
    }

    private async handleSignal(session: Session, { description, candidate }: SignalPayload) {
        const pc = session.pc;
        if (!pc || this.session !== session) return;
        try {
            if (description) {
                const readyForOffer = !session.makingOffer
                    && (pc.signalingState === 'stable' || session.isSettingRemoteAnswerPending);
                const offerCollision = description.type === 'offer' && !readyForOffer;
                session.ignoreOffer = !session.polite && offerCollision;
                if (session.ignoreOffer) return;

                session.isSettingRemoteAnswerPending = description.type === 'answer';
                await pc.setRemoteDescription(description);
                session.isSettingRemoteAnswerPending = false;

                if (description.type === 'offer') {
                    // The callee's first offer: its transceivers pick up our
                    // tracks here, so the answer carries them.
                    this.attachLocalTracks(session, pc);
                    await pc.setLocalDescription();
                    this.sendSignal(session, { description: this.describe(pc.localDescription) });
                }
                this.capVideoBitrate(pc);
            } else if (candidate) {
                try {
                    await pc.addIceCandidate(candidate);
                } catch (error) {
                    if (!session.ignoreOffer) throw error;
                }
            }
        } catch (error) {
            console.warn('Call: applying a signal failed', (error as Error)?.name);
        }
    }

    private describe(description: RTCSessionDescription | null): RTCSessionDescriptionInit | undefined {
        return description ? { type: description.type, sdp: description.sdp } : undefined;
    }

    private sendSignal(session: Session, payload: Omit<SignalPayload, 'callId' | 'conversationId'>) {
        if (!payload.description && !payload.candidate) return;
        this.socket.emit('call signal', {
            callId: session.callId,
            conversationId: session.conversationId,
            ...payload,
        });
    }

    // Encodings only exist once a sender has been negotiated, so this runs
    // after every negotiation step (and after a camera swap) - it's a no-op
    // once the cap is in place.
    private capVideoBitrate(pc: RTCPeerConnection) {
        for (const sender of pc.getSenders()) {
            if (sender.track?.kind !== 'video') continue;
            const parameters = sender.getParameters();
            if (!parameters.encodings?.length) continue;
            if (parameters.encodings.every(encoding => encoding.maxBitrate === MAX_VIDEO_BITRATE)) continue;
            parameters.encodings.forEach(encoding => {
                encoding.maxBitrate = MAX_VIDEO_BITRATE;
            });
            sender.setParameters(parameters).catch(() => {
                // Not fatal - the browser's own bandwidth estimate still applies.
            });
        }
    }

    private videoTransceiver(pc: RTCPeerConnection) {
        return pc.getTransceivers().find(transceiver =>
            transceiver.receiver.track.kind === 'video' && transceiver.currentDirection !== 'stopped'
        );
    }

    // Camera off really releases the camera (the light goes off) and stops
    // sending: the transceiver goes receive-only, and that renegotiation is
    // what mutes our video track on the other side so they see the avatar.
    private turnCameraOff(session: Session) {
        const localStream = session.localStream;
        if (!localStream) return;
        for (const track of localStream.getVideoTracks()) {
            track.stop();
            localStream.removeTrack(track);
        }
        const transceiver = session.pc ? this.videoTransceiver(session.pc) : undefined;
        if (transceiver) {
            transceiver.sender.replaceTrack(null).catch(() => { });
            transceiver.direction = 'recvonly';
        }
        this.update({ cameraOn: false, localStream: new MediaStream(localStream.getTracks()) });
    }

    private async useVideoTrack(session: Session, track: MediaStreamTrack) {
        const localStream = session.localStream!;
        for (const old of localStream.getVideoTracks()) {
            old.stop();
            localStream.removeTrack(old);
        }
        localStream.addTrack(track);
        this.update({ cameraOn: true, localStream: new MediaStream(localStream.getTracks()) });

        const pc = session.pc;
        // Before the peer connection exists (still ringing), the track is
        // simply part of the stream attached later.
        if (!pc || !session.localTracksAttached) return;

        const transceiver = this.videoTransceiver(pc);
        if (transceiver) {
            await transceiver.sender.replaceTrack(track);
            if (transceiver.direction !== 'sendrecv') transceiver.direction = 'sendrecv';
        } else {
            // An audio-only call turning the camera on - adding the track
            // renegotiates a video section into the call.
            pc.addTrack(track, localStream);
        }
        this.capVideoBitrate(pc);
    }

    private refreshRemoteVideo(session: Session) {
        if (this.session !== session) return;
        const remoteVideoOn = session.remoteStream.getVideoTracks()
            .some(track => track.readyState === 'live' && !track.muted);
        if (remoteVideoOn !== this.snapshot.remoteVideoOn) this.update({ remoteVideoOn });
    }

    private async refreshCameraCount() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const cameras = devices.filter(device => device.kind === 'videoinput').length;
            if (this.session) this.update({ canSwitchCamera: cameras > 1 });
        } catch {
            // Only decides whether the switch button shows.
        }
    }

    private handleConnectionState(session: Session, pc: RTCPeerConnection) {
        if (this.session !== session || session.pc !== pc) return;

        switch (pc.connectionState) {
            case 'connected':
                this.clearSessionTimers(session);
                this.update({
                    status: 'connected',
                    message: null,
                    connectedAt: this.snapshot.connectedAt ?? Date.now(),
                });
                this.capVideoBitrate(pc);
                break;

            case 'disconnected':
                if (this.snapshot.status !== 'connected') return;
                this.update({ status: 'reconnecting' });
                this.setSessionTimer(session, () => {
                    if (pc.connectionState === 'connected') return;
                    // One ICE restart per call. Its offer goes out through
                    // negotiationneeded like any other; perfect negotiation
                    // handles both sides restarting at once.
                    if (!session.iceRestartAttempted) {
                        session.iceRestartAttempted = true;
                        pc.restartIce();
                    }
                    this.setSessionTimer(session, () => {
                        if (pc.connectionState !== 'connected') this.failConnect(session);
                    }, RECONNECT_TIMEOUT_MS);
                }, ICE_RESTART_DELAY_MS);
                break;

            case 'failed':
                this.failConnect(session);
                break;
        }
    }

    private failureMessage() {
        return this.snapshot.connectedAt !== null
            ? "The connection dropped and couldn't be restored."
            : "Couldn't connect the call. This network may be blocking direct calls.";
    }

    private failConnect(session: Session) {
        if (this.session !== session) return;
        this.finish('failed', this.failureMessage(), 'call hangup');
    }

    // ---- Teardown --------------------------------------------------------

    // Every way a call ends goes through here: tells the server (when this
    // side is the one ending it), releases the camera and mic, closes the
    // peer connection, then shows the ended/failed state or goes idle.
    private finish(
        next: 'idle' | 'ended' | 'failed',
        message: string | null,
        notify: 'call hangup' | 'call cancel' | 'call decline' | null
    ) {
        const session = this.session;
        if (!session) return;
        this.session = null;

        if (notify) {
            this.socket.emit(notify, {
                callId: session.callId,
                conversationId: session.conversationId,
                // Lets the other side show the failed state (with retry) too.
                ...(next === 'failed' ? { reason: 'failed' } : {}),
            });
        }
        this.stopRing();
        this.clearSessionTimers(session);
        this.teardown(session);

        const peer = this.snapshot.peer;
        const video = this.snapshot.video;
        const connectedAt = this.snapshot.connectedAt;
        const wasRingingHere = this.snapshot.status === 'incoming';
        if (next === 'idle' || wasRingingHere) {
            this.update(IDLE_SNAPSHOT);
            if (next === 'ended' && wasRingingHere && peer) this.hooks.onMissedCall(peer);
            return;
        }
        this.update({
            ...IDLE_SNAPSHOT,
            status: next,
            peer,
            conversationId: session.conversationId,
            video,
            message,
            connectedAt,
        });
        if (next === 'ended') {
            this.clearEndedTimer();
            this.endedTimer = setTimeout(() => {
                this.endedTimer = null;
                if (!this.session && this.snapshot.status === 'ended') this.update(IDLE_SNAPSHOT);
            }, ENDED_DISPLAY_MS);
        }
    }

    private teardown(session: Session) {
        const pc = session.pc;
        if (pc) {
            pc.onnegotiationneeded = null;
            pc.onicecandidate = null;
            pc.ontrack = null;
            pc.onconnectionstatechange = null;
            for (const sender of pc.getSenders()) {
                sender.track?.stop();
                if (pc.signalingState !== 'closed') sender.replaceTrack(null).catch(() => { });
            }
            pc.close();
            session.pc = null;
        }
        stopStream(session.localStream);
        session.localStream = null;
        session.remoteStream.getTracks().forEach(track => {
            track.onmute = null;
            track.onunmute = null;
            track.onended = null;
            session.remoteStream.removeTrack(track);
        });
    }

    // ---- Timers and ring -------------------------------------------------

    private setSessionTimer(session: Session, fn: () => void, ms: number) {
        const timer = setTimeout(() => {
            session.timers.delete(timer);
            if (this.session === session) fn();
        }, ms);
        session.timers.add(timer);
    }

    private clearSessionTimers(session: Session) {
        session.timers.forEach(timer => clearTimeout(timer));
        session.timers.clear();
    }

    private clearEndedTimer() {
        if (this.endedTimer) clearTimeout(this.endedTimer);
        this.endedTimer = null;
    }

    private startRing() {
        if (!this.ring) {
            this.ring = new Audio('/sounds/ring.wav');
            this.ring.loop = true;
            this.ring.volume = 0.5;
        }
        this.ring.currentTime = 0;
        // Autoplay can refuse before the user has interacted with the page -
        // the incoming-call card is still on screen either way.
        this.ring.play().catch(() => { });
    }

    private stopRing() {
        this.ring?.pause();
    }
}
