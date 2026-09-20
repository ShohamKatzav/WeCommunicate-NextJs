'use client';
import { RefObject, useEffect } from 'react';
import { Mic, Send, Trash2 } from 'lucide-react';
import ChatUser from '@/types/chatUser';
import FileDTO from '@/types/FileDTO';
import useIsMobile from '../hooks/useIsMobile';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { MAX_VOICE_MESSAGE_SECONDS } from '../config/limits';

interface VoiceRecorderProps {
    participants: RefObject<ChatUser[] | null | undefined>;
    onRecorded: (file: FileDTO) => Promise<void>;
    onStatusChange: (isRecordingOrUploading: boolean) => void;
}

const formatDuration = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const VoiceRecorder = ({ participants, onRecorded, onStatusChange }: VoiceRecorderProps) => {
    const isMobile = useIsMobile();
    const { status, elapsedSeconds, startRecording, stopAndSend, cancelRecording } = useVoiceRecorder({ onRecorded });

    // Lets ChatInputBar hide the normal text-input row while recording or
    // uploading - notified via an effect, not read directly during render,
    // since this updates a *different* component's state (ChatInputBar's).
    useEffect(() => {
        onStatusChange(status !== 'idle');
    }, [status, onStatusChange]);

    if (status === 'recording') {
        return (
            <div className="flex items-center gap-2 flex-1 bg-red-50 dark:bg-red-950/30 rounded-xl px-3 py-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                <span className="text-sm text-red-600 dark:text-red-400 tabular-nums shrink-0">
                    {formatDuration(elapsedSeconds)} / {formatDuration(MAX_VOICE_MESSAGE_SECONDS)}
                </span>
                <span className="flex-1" />
                <button
                    type="button"
                    onClick={cancelRecording}
                    aria-label="Cancel voice message"
                    className="p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900 shrink-0"
                >
                    <Trash2 size={20} className="text-red-500" />
                </button>
                <button
                    type="button"
                    onClick={stopAndSend}
                    aria-label="Send voice message"
                    className="p-2 rounded-full bg-green-500 text-white hover:bg-green-600 shrink-0"
                >
                    <Send size={20} />
                </button>
            </div>
        );
    }

    if (status === 'uploading') {
        return (
            <div className="flex items-center gap-2 flex-1 px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent" />
                Sending voice message...
            </div>
        );
    }

    return (
        <button
            type="button"
            onClick={startRecording}
            disabled={!participants.current}
            aria-label="Record voice message"
            className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
        >
            <Mic size={isMobile ? 25 : 30} />
        </button>
    );
};

export default VoiceRecorder;
