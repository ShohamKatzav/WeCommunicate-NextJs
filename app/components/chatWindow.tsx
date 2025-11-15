"use client"
import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import Message from "@/types/message";
import MessageViewer from "./messageBubble";
import MoreMessagesLoader from "./moreMessagesLoader";
import ChatUser from "@/types/chatUser";
import { HiOutlineChatBubbleLeftRight } from "react-icons/hi2";

interface ChatWindowProps {
    messages: Message[];
    setReloadKey: Dispatch<SetStateAction<boolean>>;
    participants: React.RefObject<ChatUser[] | null | undefined>;
    isMobile: boolean;
}

const ChatWindow = ({ messages, participants, setReloadKey, isMobile }: ChatWindowProps) => {
    const [loadNew, setLoadNew] = useState(false);
    const chatBox = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const el = chatBox.current;
        if (el) {
            el.scrollTop = el.scrollHeight;
        }
    }, [chatBox?.current?.scrollHeight]);

    const handleScroll = () => {
        const el = chatBox.current;
        if (!el) return;
        const scrolledToTop = Math.abs(el.scrollTop) < 25;

        if (scrolledToTop && !loadNew) {
            setLoadNew(true);
        }
    }
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
    }, [chatBox.current, loadNew]); // Add loadNew dependency

    useEffect(() => {
        setLoadNew(false);
    }, [participants.current]);

    return (
        <div
            className={`flex-1 bg-linear-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 ${!participants.current ?
                "flex items-center justify-center" : ""}`}>
            {
                participants.current ?
                    (<div className="bg-white dark:bg-gray-800 rounded-2xl border-gray-200 dark:border-gray-700">
                        <div>
                            {messages.length === 0 && <div className="text-sm text-gray-400 self-start">No messages yet — say hi 👋</div>}
                            <div ref={chatBox} className="flex flex-col-reverse h-[60vh] overflow-y-scroll w-full p-2">
                                <div>
                                    {messages.map((message, index) =>
                                        <MessageViewer key={index} message={message} setReloadKey={setReloadKey} />)
                                    }
                                </div>
                                {chatBox?.current?.scrollTop != 0 && loadNew &&
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