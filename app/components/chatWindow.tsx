"use client"
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import Message from "@/types/message";
import MessageBubble from "./messageBubble";
import MoreMessagesLoader from "./moreMessagesLoader";
import OfflineOutbox from "./offlineOutbox";
import ChatUser from "@/types/chatUser";
import { HiOutlineChatBubbleLeftRight } from "react-icons/hi2";

interface ChatWindowProps {
    messages: Message[];
    participants: React.RefObject<ChatUser[] | null | undefined>;
    isMobile: boolean;
    onReply: (message: Message) => void;
    conversationId: string;
    firstUnreadMessageId?: string;
    clearedAt?: string;
}

const ChatWindow = ({ messages, participants, isMobile, onReply, conversationId, firstUnreadMessageId, clearedAt }: ChatWindowProps) => {
    const [loadNew, setLoadNew] = useState(true);
    const chatBox = useRef<HTMLDivElement | null>(null);
    const dividerRef = useRef<HTMLDivElement | null>(null);
    // Distinguishes "just switched to a different conversation" from "a
    // message changed within the one already open" - only the former should
    // ever land on the unread divider instead of the bottom.
    const previousConversationId = useRef<string>("");

    const handleScroll = () => {
        const el = chatBox.current;
        if (!el) return;
        const scrolledToTop = Math.abs(el.scrollTop) < 50;
        if (scrolledToTop && !loadNew) {
            setLoadNew(true);
        }
    }

    useLayoutEffect(() => {
        const roomChanged = previousConversationId.current !== conversationId;
        previousConversationId.current = conversationId;

        // Land on where the user left off instead of the very bottom, but
        // only on the initial view of a conversation that has one - once
        // you're already looking at it, every other message change (a new
        // message, an edit, a delete) still snaps to the bottom exactly as
        // before.
        if (roomChanged && firstUnreadMessageId && dividerRef.current) {
            dividerRef.current.scrollIntoView({ block: 'center' });
            return;
        }

        if (chatBox.current) {
            chatBox.current.scrollTop = chatBox.current.scrollHeight;
        }
    }, [messages, conversationId, firstUnreadMessageId]);

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
            className={`flex min-h-0 flex-1 flex-col overflow-hidden bg-linear-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-3 xl:p-4 ${!participants.current ?
                "flex items-center justify-center" : ""}`}>
            <OfflineOutbox />
            {
                participants.current ?
                    (<div className="flex min-h-0 flex-1 flex-col bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
                        <div className="flex min-h-0 flex-1 flex-col">
                            {(!messages || messages?.length === 0) && <div className="text-sm text-muted-foreground self-start p-3">No messages yet — say hi 👋</div>}
                            <div ref={chatBox} className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto w-full p-2">
                                <div>
                                    {messages?.map((message, index) =>
                                        // Incoming messages re-sort this array by date (see
                                        // handleIncomingMessage), which can reorder existing
                                        // items - an index key would then reattach a bubble's
                                        // state (deleted, playback position, etc.) to whatever
                                        // message now happens to occupy that index.
                                        <Fragment key={message._id || `msg-${index}`}>
                                            {message._id === firstUnreadMessageId && (
                                                <div ref={dividerRef} data-testid="unread-divider" className="flex items-center gap-2 my-3">
                                                    <div className="flex-1 h-px bg-red-300 dark:bg-red-700" />
                                                    <span className="text-xs font-medium text-red-500 dark:text-red-400">Unread messages</span>
                                                    <div className="flex-1 h-px bg-red-300 dark:bg-red-700" />
                                                </div>
                                            )}
                                            <MessageBubble message={message} onReply={onReply} />
                                        </Fragment>)
                                    }
                                </div>
                                {(messages?.length === parseInt(process.env.NEXT_PUBLIC_MESSAGES_PER_PAGE!) || loadNew) &&
                                    <MoreMessagesLoader oldMessages={messages} participants={participants.current} onReply={onReply} clearedAt={clearedAt} />
                                }
                            </div>
                        </div>
                    </div>) :
                    (<div className="text-muted-foreground">
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
