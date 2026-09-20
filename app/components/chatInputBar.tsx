import { Dispatch, RefObject, SetStateAction, useCallback, useState } from "react";
import Message from "@/types/message";
import ChatUser from "@/types/chatUser";
import FileDTO from "@/types/FileDTO";
import { Send, X } from "lucide-react";
import UploadFile from "./uploadFile";
import VoiceRecorder from "./voiceRecorder";
import useIsMobile from "../hooks/useIsMobile";
import { MAX_MESSAGE_LENGTH } from "../config/limits";
import { AsShortName } from "../utils/stringFormat";
import { useUser } from "../hooks/useUser";

interface MessageInputProps {
    message: Message;
    setMessage: Dispatch<SetStateAction<Message>>;
    participants: RefObject<ChatUser[] | null | undefined>;
    handleSendMessage: (overrideFile?: FileDTO) => Promise<void>;
    handleTyping: () => void;
    isBlocked: boolean;
}

const ChatInputBar = ({ message, setMessage, participants, handleSendMessage, handleTyping, isBlocked }: MessageInputProps) => {
    const isMobile = useIsMobile();
    const { user } = useUser();
    const [isRecordingVoice, setIsRecordingVoice] = useState(false);
    // The server rejects a blocked 1:1 send regardless (see
    // chatActions.saveMessage) - disabling here too avoids the confusing
    // "I hit send and it just vanished with a vague error" experience.
    const canSend = (message.text?.trim() || message.file) && participants.current && !isBlocked;

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && canSend) {
            handleSendMessage();
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setMessage(prev => ({ ...prev, text: e.target.value }));
        handleTyping();
    };

    const cancelReply = () => {
        setMessage(prev => ({ ...prev, replyTo: undefined }));
    };

    // A voice message sends itself as soon as recording is uploaded - it
    // doesn't go through the normal draft/attach-then-click-send flow.
    const handleVoiceRecorded = useCallback((file: FileDTO) => handleSendMessage(file), [handleSendMessage]);

    return (
        <div className="w-full xl:w-[75%] xl:place-self-center">
            <div className={`flex flex-col gap-2 ${isMobile ? 'px-3' : ''}`}>
                {isBlocked && (
                    <div className="rounded-lg bg-gray-100 dark:bg-gray-700 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 text-center">
                        {"You can't send messages to a blocked user. Unblock them from the users list to continue."}
                    </div>
                )}
                {message.replyTo && (
                    <div className="flex items-center justify-between gap-2 rounded-lg bg-gray-100 dark:bg-gray-700 border-l-4 border-green-500 px-3 py-2">
                        <div className="min-w-0">
                            <div className="text-sm font-medium text-success">
                                Replying to {message.replyTo.sender === user?.email ? "yourself" : AsShortName(message.replyTo.sender)}
                            </div>
                            <div className="text-sm text-muted-foreground truncate">
                                {message.replyTo.snippet || "Attachment"}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={cancelReply}
                            aria-label="Cancel reply"
                            className="shrink-0 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"
                        >
                            <X size={18} />
                        </button>
                    </div>
                )}
                {!isRecordingVoice && (
                    // Rendered once regardless of the mobile/desktop layout
                    // below - a staged (not-yet-sent) upload's state lives
                    // inside UploadFile itself, so having two separate
                    // instances (one per layout) meant crossing the mobile
                    // breakpoint unmounted whichever one was active and
                    // silently deleted the file the user had just attached.
                    <div className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 cursor-pointer shrink-0 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors w-fit">
                        <UploadFile message={message} setMessage={setMessage} />
                    </div>
                )}

                {/* VoiceRecorder is always mounted at exactly one call site
                    per layout branch below - never behind an
                    isRecordingVoice conditional itself, since its own
                    useVoiceRecorder hook instance holds the live
                    MediaRecorder/stream. Toggling which JSX branch renders
                    it (the way the surrounding input/button are toggled)
                    would unmount-and-remount it the instant recording
                    starts, killing the stream immediately - the same class
                    of bug UploadFile's own comment above describes. */}
                {isMobile ? (
                    <>
                        {!isRecordingVoice && (
                            <input
                                className="w-full p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 border border-transparent dark:border-gray-600 transition-all"
                                onKeyDown={handleKeyDown}
                                placeholder={participants.current ? "Message..." : "Select a participant to start chatting"}
                                type="text"
                                value={message.text}
                                onChange={handleChange}
                                disabled={!participants.current}
                                maxLength={MAX_MESSAGE_LENGTH}
                                aria-label="Message input"
                            />
                        )}
                        <div className="flex items-center gap-2">
                            <VoiceRecorder participants={participants} onRecorded={handleVoiceRecorded} onStatusChange={setIsRecordingVoice} />
                            {!isRecordingVoice && (
                                <button
                                    onClick={() => handleSendMessage()}
                                    disabled={!canSend}
                                    className="w-full p-1.5 rounded-lg bg-green-700 text-white disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-green-800 active:scale-95 transition-all font-medium"
                                    aria-label="Send message"
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        <Send size={18} />
                                        <span>Send</span>
                                    </div>
                                </button>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex items-center gap-3">
                        {!isRecordingVoice && (
                            <input
                                className="flex-1 p-3 rounded-xl bg-gray-100 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 border border-transparent dark:border-gray-600 transition-all"
                                onKeyDown={handleKeyDown}
                                placeholder={participants.current ? "Message..." : "Select a participant to start chatting"}
                                type="text"
                                value={message.text}
                                onChange={handleChange}
                                disabled={!participants.current}
                                maxLength={MAX_MESSAGE_LENGTH}
                                aria-label="Message input"
                            />
                        )}
                        <VoiceRecorder participants={participants} onRecorded={handleVoiceRecorded} onStatusChange={setIsRecordingVoice} />
                        {!isRecordingVoice && (
                            <button
                                onClick={() => handleSendMessage()}
                                disabled={!canSend}
                                className="p-2 rounded-full bg-green-700 text-white shrink-0 disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-green-800 active:scale-95 transition-all"
                                aria-label="Send message"
                            >
                                <Send size={30} />
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatInputBar;
