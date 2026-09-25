"use client"
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import Message from "@/types/message";
import MessageBubble from "./messageBubble";
import MoreMessagesLoader from "./moreMessagesLoader";
import DayChip from "./dayChip";
import { startsNewDay } from "../../utils/dayLabel";
import OfflineOutbox from "../offline/offlineOutbox";
import ChatUser from "@/types/chatUser";
import { HiOutlineChatBubbleLeftRight } from "react-icons/hi2";
import { accentForSender, accentsForReceivedBubbles } from "../../utils/accentColor";

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
    // Count and last id of the list last scrolled for, to tell a message
    // arriving from one that changed in place.
    const previousListKey = useRef<string>("");

    const accentBySender = accentsForReceivedBubbles(participants.current);
    // When the newest older-page message above this list was sent. A day
    // chip goes above this list's first message only when that one starts a
    // new day relative to it - otherwise the same day would get two chips.
    const [newestLoadedAt, setNewestLoadedAt] = useState<number>();

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
        const listKey = `${messages?.length ?? 0}|${messages?.[messages.length - 1]?._id ?? ""}`;
        const listChanged = previousListKey.current !== listKey;
        previousListKey.current = listKey;

        // Land on where the user left off instead of the very bottom, but
        // only on the initial view of a conversation that has one - once
        // you're already looking at it, a new message still snaps to the
        // bottom exactly as before.
        if (roomChanged && firstUnreadMessageId && dividerRef.current) {
            dividerRef.current.scrollIntoView({ block: 'center' });
            return;
        }

        // A change in place (an edit, a delete, a read receipt) leaves the
        // view where it is: snapping would pull someone who scrolled up to
        // edit an older message - or who's reading back while the other side
        // edits one - away from it. The list is flex-col-reverse, so a reader
        // already at the bottom stays there without help.
        if (!roomChanged && !listChanged) return;

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
                            {(!messages || messages?.length === 0) && (
                                <div className="flex flex-col items-center gap-1 px-4 py-6 text-center">
                                    <HiOutlineChatBubbleLeftRight size={28} className="text-muted-foreground opacity-50" aria-hidden="true" />
                                    <p className="text-sm font-medium">No messages yet</p>
                                    <p className="text-xs text-muted-foreground">Say hi 👋 — your first message starts this conversation.</p>
                                </div>
                            )}
                            <div ref={chatBox} className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto w-full p-2">
                                <div>
                                    {messages?.map((message, index) =>
                                        // Incoming messages re-sort this array by date (see
                                        // handleIncomingMessage), which can reorder existing
                                        // items - an index key would then reattach a bubble's
                                        // state (deleted, playback position, etc.) to whatever
                                        // message now happens to occupy that index.
                                        <Fragment key={message._id || `msg-${index}`}>
                                            {startsNewDay(message.date, index > 0 ? messages[index - 1].date : newestLoadedAt) && (
                                                <DayChip date={message.date!} />
                                            )}
                                            {message._id === firstUnreadMessageId && (
                                                <div ref={dividerRef} data-testid="unread-divider" className="flex items-center gap-2 my-3">
                                                    <div className="flex-1 h-px bg-red-300 dark:bg-red-700" />
                                                    <span className="text-xs font-medium text-red-500 dark:text-red-400">Unread messages</span>
                                                    <div className="flex-1 h-px bg-red-300 dark:bg-red-700" />
                                                </div>
                                            )}
                                            <MessageBubble
                                                message={message}
                                                onReply={onReply}
                                                senderAccentColor={accentForSender(accentBySender, message.sender)}
                                            />
                                        </Fragment>)
                                    }
                                </div>
                                {(messages?.length === parseInt(process.env.NEXT_PUBLIC_MESSAGES_PER_PAGE!) || loadNew) &&
                                    <MoreMessagesLoader oldMessages={messages} participants={participants.current} onReply={onReply} clearedAt={clearedAt} onNewestLoadedChange={setNewestLoadedAt} />
                                }
                            </div>
                        </div>
                    </div>) :
                    (<div className="flex w-full max-w-sm flex-col items-center gap-2 px-4 text-center text-muted-foreground">
                        <HiOutlineChatBubbleLeftRight size={40} className="opacity-40" aria-hidden="true" />
                        <h4 className="text-lg font-semibold text-foreground sm:text-xl">No conversation selected</h4>
                        {isMobile ?
                            // The inline icon marks the same button the header
                            // actually shows, so it has to sit in the flow of
                            // the sentence - wrap instead of overflowing it on
                            // a narrow screen.
                            <p className="flex flex-wrap items-center justify-center gap-1 text-sm">
                                Select a chat, or start a new one with the
                                <HiOutlineChatBubbleLeftRight className="inline shrink-0" aria-hidden="true" />
                                button.
                            </p>
                            : <p className="text-sm">
                                Choose a chat from the left, or start a new one.
                            </p>
                        }
                    </div>)
            }
        </div>

    );
}
export default ChatWindow;
