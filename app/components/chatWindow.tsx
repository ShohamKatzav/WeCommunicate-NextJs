"use client"
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Message from "@/types/message";
import MessageBubble from "./messageBubble";
import MoreMessagesLoader from "./moreMessagesLoader";
import ChatUser from "@/types/chatUser";
import { HiOutlineChatBubbleLeftRight } from "react-icons/hi2";

interface ChatWindowProps {
    messages: Message[];
    participants: React.RefObject<ChatUser[] | null | undefined>;
    isMobile: boolean;
}

const ChatWindow = ({ messages, participants, isMobile }: ChatWindowProps) => {
    const [loadNew, setLoadNew] = useState(true);
    const chatBox = useRef<HTMLDivElement | null>(null);

    const handleScroll = () => {
        const el = chatBox.current;
        if (!el) return;
        const scrolledToTop = Math.abs(el.scrollTop) < 50;
        if (scrolledToTop && !loadNew) {
            setLoadNew(true);
        }
    }

    useLayoutEffect(() => {
        if (chatBox.current)
            chatBox.current.scrollTop = chatBox.current.scrollHeight;
    }, [messages]);

    useEffect(() => {
        const currentChatBox = chatBox?.current;
        if (currentChatBox) {
            currentChatBox.addEventListener('scroll', handleScroll);
        }
        return () => {
            if (currentChatBox) {
                currentChatBox.removeEventListener('scroll', handleScroll);
            }
        };
    }, [chatBox.current, loadNew]);

    return (
        <div
            className={`flex-1 bg-linear-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 ${!participants.current ?
                "flex items-center justify-center" : ""}`}>
            {
                participants.current ?
                    (<div className="bg-white dark:bg-gray-800 rounded-2xl border-gray-200 dark:border-gray-700">
                        <div>
                            {(!messages || messages?.length === 0) && <div className="text-sm text-gray-400 self-start">No messages yet — say hi 👋</div>}
                            <div ref={chatBox} className="flex flex-col-reverse h-[60vh] overflow-y-scroll w-full p-2">
                                <div>
                                    {messages?.map((message, index) =>
                                        <MessageBubble key={index} message={message} />)
                                    }
                                </div>
                                {(messages?.length === parseInt(process.env.NEXT_PUBLIC_MESSAGES_PER_PAGE!) || loadNew) &&
                                    <MoreMessagesLoader oldMessages={messages} participants={participants.current} />
                                }
                            </div>
                        </div>
                    </div>) :
                    (<div className="text-gray-500">
                        <div className="text-center">
                            <h4 className="text-xl font-semibold mb-2">No conversation selected</h4>
                            {isMobile ?
                                <p className="text-sm flex items-center gap-1">
                                    Select a chat or start a new one with the
                                    <HiOutlineChatBubbleLeftRight className="inline text-gray-700" />
                                    button.
                                </p>
                                : <p className="text-sm flex items-center gap-1">
                                    Choose a chat from the left or start a new one.
                                </p>
                            }
                        </div>
                    </div>)
            }
        </div>

    );
}
export default ChatWindow;