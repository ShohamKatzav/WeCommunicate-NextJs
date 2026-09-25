import { ChangeEvent, Dispatch, KeyboardEvent, RefObject, SetStateAction, useCallback, useLayoutEffect, useRef, useState } from "react";
import Message from "@/types/message";
import ChatUser from "@/types/chatUser";
import FileDTO from "@/types/FileDTO";
import { Send, X } from "lucide-react";
import { UploadFileButton, UploadFileProvider, UploadFileStatus } from "../ui/uploadFile";
import VoiceRecorder from "./voiceRecorder";
import ShareLocationButton from "../locations/shareLocationButton";
import MessageLocation from "@/types/messageLocation";
import useIsMobile from "../../hooks/useIsMobile";
import { MAX_MESSAGE_LENGTH } from "../../config/limits";
import { AsShortName } from "../../utils/stringFormat";
import { useUser } from "../../hooks/useUser";

// The composer grows with the draft up to this many lines, then scrolls
// inside itself, the way WhatsApp's does.
const MAX_COMPOSER_LINES = 6;

interface ComposerTextareaProps {
    value: string | undefined;
    onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
    onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
    placeholder: string;
    disabled: boolean;
    className: string;
}

// Shared by the mobile and desktop layouts so the two can't drift.
// dir="auto" plus unicode-bidi: plaintext gives each line the direction of
// its first strong character, so a Hebrew draft is laid out RTL and a
// trailing emoji lands at the RTL end (the left) rather than the right edge
// an LTR paragraph would put it on. An empty or English draft stays LTR.
const ComposerTextarea = ({ value, onChange, onKeyDown, placeholder, disabled, className }: ComposerTextareaProps) => {
    const ref = useRef<HTMLTextAreaElement>(null);

    // Runs on every value change, so the reset to '' after a send shrinks
    // the field back to one line too.
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const style = getComputedStyle(el);
        const border = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
        const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
        const lineHeight = parseFloat(style.lineHeight) || 24;
        el.style.height = "auto";
        // scrollHeight is content + padding; the box is border-box, so add the border back.
        el.style.height = `${Math.min(el.scrollHeight + border, lineHeight * MAX_COMPOSER_LINES + padding + border)}px`;
    }, [value]);

    return (
        <textarea
            ref={ref}
            rows={1}
            dir="auto"
            style={{ unicodeBidi: "plaintext" }}
            className={`block resize-none overflow-y-auto bg-gray-100 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 border border-transparent dark:border-gray-600 transition-[box-shadow,border-color] ${className}`}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            disabled={disabled}
            maxLength={MAX_MESSAGE_LENGTH}
            aria-label="Message input"
        />
    );
};

interface MessageInputProps {
    message: Message;
    setMessage: Dispatch<SetStateAction<Message>>;
    participants: RefObject<ChatUser[] | null | undefined>;
    handleSendMessage: (overrideFile?: FileDTO, overrideLocation?: MessageLocation) => Promise<void>;
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
    const placeholder = participants.current ? "Message..." : "Select a participant to start chatting";

    // Desktop only, like WhatsApp Web: Enter sends and Shift+Enter is a
    // newline. On mobile Enter is a newline and only the Send button sends.
    const handleDesktopKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
        e.preventDefault();
        if (canSend) handleSendMessage();
    };

    const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        setMessage(prev => ({ ...prev, text: e.target.value }));
        handleTyping();
    };

    const cancelReply = () => {
        setMessage(prev => ({ ...prev, replyTo: undefined }));
    };

    // A voice message sends itself as soon as recording is uploaded - it
    // doesn't go through the normal draft/attach-then-click-send flow.
    const handleVoiceRecorded = useCallback((file: FileDTO) => handleSendMessage(file), [handleSendMessage]);

    // Same shape as a voice message: the pin is the whole message, so it
    // sends the moment it's picked up rather than being staged as a draft.
    const handleLocationShared = useCallback(
        (location: MessageLocation) => handleSendMessage(undefined, location),
        [handleSendMessage]
    );

    return (
        <UploadFileProvider message={message} setMessage={setMessage} suspended={isRecordingVoice}>
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
                                <span dir="auto">{message.replyTo.snippet || "Attachment"}</span>
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
                {/* The provider above owns the staged file, so this chip and
                    the attach button below can sit in different layout
                    branches without a second upload instance. Crossing the
                    mobile breakpoint used to unmount that instance and
                    silently delete the file. */}
                <UploadFileStatus />

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
                            <ComposerTextarea
                                className="w-full p-1.5 rounded-lg"
                                placeholder={placeholder}
                                value={message.text}
                                onChange={handleChange}
                                disabled={!participants.current}
                            />
                        )}
                        <div className="flex items-center gap-2">
                            <UploadFileButton />
                            {!isRecordingVoice && (
                                <ShareLocationButton participants={participants} onShare={handleLocationShared} disabled={isBlocked} />
                            )}
                            <VoiceRecorder participants={participants} onRecorded={handleVoiceRecorded} onStatusChange={setIsRecordingVoice} />
                            {!isRecordingVoice && (
                                <button
                                    onClick={() => handleSendMessage()}
                                    disabled={!canSend}
                                    className="min-w-0 flex-1 whitespace-nowrap p-1.5 rounded-lg bg-green-700 text-white disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-green-800 active:scale-95 transition-all font-medium"
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
                    // items-end keeps the buttons on the bottom line as the
                    // field grows, like WhatsApp Web.
                    <div className="flex items-end gap-3">
                        <UploadFileButton />
                        {!isRecordingVoice && (
                            <ShareLocationButton participants={participants} onShare={handleLocationShared} disabled={isBlocked} />
                        )}
                        {!isRecordingVoice && (
                            <ComposerTextarea
                                className="flex-1 min-w-0 p-3 rounded-xl"
                                onKeyDown={handleDesktopKeyDown}
                                placeholder={placeholder}
                                value={message.text}
                                onChange={handleChange}
                                disabled={!participants.current}
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
        </UploadFileProvider>
    );
};

export default ChatInputBar;
