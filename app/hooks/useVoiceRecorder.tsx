'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type PutBlobResult } from '@vercel/blob';
import { upload } from '@vercel/blob/client';
import { toast } from 'sonner';
import FileDTO from '@/types/FileDTO';
import { useUser } from './useUser';
import { MAX_VOICE_MESSAGE_SECONDS } from '../config/limits';
import { useT } from '../i18n/client';

type RecorderStatus = 'idle' | 'recording' | 'uploading';

// Preference order for what to record in: webm+opus is broadly supported
// (Chrome/Firefox/Android); Safari/iOS supports neither webm variant and
// records mp4 instead - listing both means whichever the browser can
// actually produce gets picked, rather than hardcoding one and breaking on
// the other (see app/api/send-file/route.ts's allowedContentTypes, which
// has to accept whatever this list can produce).
const RECORDING_MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac'];

function pickSupportedMimeType(): string | undefined {
    if (typeof MediaRecorder === 'undefined') return undefined;
    return RECORDING_MIME_CANDIDATES.find(type => MediaRecorder.isTypeSupported(type));
}

function extensionForMimeType(mimeType: string): string {
    if (mimeType.includes('mp4')) return 'm4a';
    if (mimeType.includes('aac')) return 'aac';
    return 'webm';
}

interface UseVoiceRecorderProps {
    // Called once the recording has finished uploading - the caller is
    // responsible for actually sending it as a message.
    onRecorded: (file: FileDTO) => Promise<void>;
}

export const useVoiceRecorder = ({ onRecorded }: UseVoiceRecorderProps) => {
    const { user } = useUser();
    const t = useT();
    const [status, setStatus] = useState<RecorderStatus>('idle');
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const cancelledRef = useRef(false);

    const stopTracks = useCallback(() => {
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    }, []);

    const uploadAndSend = useCallback(async (mimeType: string) => {
        if (chunksRef.current.length === 0 || !user?.token) {
            setStatus('idle');
            setElapsedSeconds(0);
            return;
        }
        setStatus('uploading');
        try {
            const blob = new Blob(chunksRef.current, { type: mimeType });
            const filename = `voice-message-${Date.now()}.${extensionForMimeType(mimeType)}`;
            const file = new File([blob], filename, { type: mimeType });

            const uploaded: PutBlobResult = await upload(filename, file, {
                access: 'public',
                handleUploadUrl: '/api/send-file',
                headers: {
                    email: user.email!,
                    authorization: `Bearer ${user.token}`
                }
            });

            await onRecorded({
                contentType: uploaded.contentType,
                url: uploaded.url,
                downloadUrl: uploaded.downloadUrl,
                pathname: uploaded.pathname
            });
        } catch (err) {
            console.error('Failed to send voice message:', err);
            toast.error(t('chat.voice.sendFailed'));
        } finally {
            setStatus('idle');
            setElapsedSeconds(0);
        }
    }, [user, onRecorded, t]);

    const startRecording = useCallback(async () => {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
            toast.error(t('chat.voice.unsupported'));
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            const mimeType = pickSupportedMimeType();
            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            chunksRef.current = [];
            cancelledRef.current = false;

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };
            recorder.onstop = () => {
                stopTracks();
                if (timerRef.current) {
                    clearInterval(timerRef.current);
                    timerRef.current = null;
                }
                if (cancelledRef.current) {
                    setStatus('idle');
                    setElapsedSeconds(0);
                    return;
                }
                // recorder.mimeType echoes back the full string passed to the
                // constructor, e.g. "audio/webm;codecs=opus" - but the
                // upload's allowedContentTypes allowlist (send-file/route.ts)
                // matches the bare MIME type, not codec parameters, so
                // uploading with the codecs suffix still attached gets
                // rejected by Vercel Blob as an unrecognized content type.
                // Chrome (especially headless / fake devices) can still
                // report video/webm for an audio-only stream - coerce that
                // so the bubble renders an audio player, not a video tag.
                const recordedMimeType = (recorder.mimeType || mimeType || 'audio/webm').split(';')[0];
                const uploadMimeType = recordedMimeType.startsWith('video/webm')
                    ? 'audio/webm'
                    : recordedMimeType;
                void uploadAndSend(uploadMimeType);
            };

            mediaRecorderRef.current = recorder;
            recorder.start();
            setStatus('recording');
            setElapsedSeconds(0);
            timerRef.current = setInterval(() => {
                setElapsedSeconds(prev => {
                    const next = prev + 1;
                    if (next >= MAX_VOICE_MESSAGE_SECONDS) {
                        mediaRecorderRef.current?.stop();
                    }
                    return next;
                });
            }, 1000);
        } catch (err) {
            console.error('Failed to start voice recording:', err);
            toast.error(t('chat.voice.micDenied'));
        }
    }, [stopTracks, uploadAndSend, t]);

    const stopAndSend = useCallback(() => {
        mediaRecorderRef.current?.stop();
    }, []);

    const cancelRecording = useCallback(() => {
        cancelledRef.current = true;
        mediaRecorderRef.current?.stop();
    }, []);

    // Release the mic and stop the timer if whatever is using this hook
    // unmounts mid-recording (e.g. the user switches conversations).
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            stopTracks();
        };
    }, [stopTracks]);

    return {
        status,
        elapsedSeconds,
        startRecording,
        stopAndSend,
        cancelRecording
    };
};
