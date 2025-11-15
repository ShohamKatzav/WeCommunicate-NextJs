import { Dispatch, RefObject, SetStateAction } from "react";
import Message from "@/types/message";
import ChatUser from "@/types/chatUser";
import { Send } from "lucide-react";
import UploadFile from "./uploadFile";

interface MessageInputProps {
    message: Message;
    setMessage: Dispatch<SetStateAction<Message>>;
    participants: RefObject<ChatUser[] | null | undefined>;
    handleSendMessage: () => Promise<void>;
}

const ChatInputBar = ({ message, setMessage, participants, handleSendMessage }: MessageInputProps) => {
    return (
        <div className="w-full md:w-[75%] md:place-self-center dark:border-gray-700">
            {/* Mobile: Vertical layout */}
            <div className="flex flex-col gap-2 md:hidden px-3">
                <div className="md:flex grid items-center gap-2">
                    <label className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 cursor-pointer shrink-0 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colorss">
                        <UploadFile message={message} setMessage={setMessage} />
                    </label>
                </div>
                <input
                    className="w-full p-1.5 md:p-3 rounded-lg bg-gray-100 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 border border-transparent dark:border-gray-600 transition-all"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && (message.text?.trim() || message.file)) {
                            handleSendMessage();
                        }
                    }}
                    placeholder={participants.current ? "Message..." : "Select a participant to start chatting"}
                    type="text"
                    value={message.text}
                    onChange={(e) =>
                        setMessage(prev => ({
                            ...prev,
                            text: e.target.value
                        }))
                    }
                    disabled={!participants.current}
                    aria-label="Message input"
                />
                <button
                    onClick={handleSendMessage}
                    disabled={!message.text?.trim() && !message.file}
                    className="w-full p-1.5 md:p-2.5 rounded-lg bg-green-500 text-white disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-green-600 active:scale-95 transition-all font-medium"
                    aria-label="Send message"
                >
                    <div className="flex items-center justify-center gap-2">
                        <Send size={18} />
                        <span>Send</span>
                    </div>
                </button>
            </div>

            {/* Desktop: Horizontal layout */}
            <div className="hidden md:flex items-center gap-3">
                <label className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 cursor-pointer shrink-0 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                    <UploadFile message={message} setMessage={setMessage} />
                </label>
                <input
                    className="flex-1 p-3 rounded-xl bg-gray-100 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 border border-transparent dark:border-gray-600 transition-all"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && (message.text?.trim() || message.file)) {
                            handleSendMessage();
                        }
                    }}
                    placeholder={participants.current ? "Message..." : "Select a participant to start chatting"}
                    type="text"
                    value={message.text}
                    onChange={(e) =>
                        setMessage(prev => ({
                            ...prev,
                            text: e.target.value
                        }))
                    }
                    disabled={!participants.current}
                    aria-label="Message input"
                />
                <button
                    onClick={handleSendMessage}
                    disabled={!message.text?.trim() && !message.file}
                    className="p-2 rounded-full bg-green-500 text-white shrink-0 disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-green-600 active:scale-95 transition-all"
                    aria-label="Send message"
                >
                    <Send size={30} />
                </button>
            </div>
        </div>
    );
}
export default ChatInputBar;