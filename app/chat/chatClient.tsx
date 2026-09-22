'use client';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useUser } from '../hooks/useUser';
import { useSocket } from '../hooks/useSocket';
import useIsMobile from '../hooks/useIsMobile';
import ChatUser from '@/types/chatUser';
import Conversation from '@/types/conversation';
import Message from '@/types/message';
import FileDTO from '@/types/FileDTO';
import { getSharedContent } from '../lib/shareActions';
import { blockUser, unblockUser } from '../lib/blockActions';
import ChatInputBar from '../components/chatInputBar';
import ChatWindow from '../components/chatWindow';
import Loading from '../components/loading';
import ChatCreationForm from '../components/chatCreationForm';
import ConversationsBar from '../components/conversationsBar';
import ChatHeader from '../components/chatHeader';
import UsersList from '../components/usersList';
import PushNotificationManager from '../components/pushNotificationManager';
import { useServiceWorkerSync } from '../hooks/useServiceWorkerSync';
import { useChatRoom } from '../hooks/useChatRoom';
import { useMessageHandling } from '../hooks/useMessageHandling';
import { useConversationsManager } from '../hooks/useConversationsManager';
import { useSocketEvents } from '../hooks/useSocketEvents';
import { usePendingCleanHistory } from '../hooks/usePendingCleanHistory';

interface ChatClientProps {
    initialUsers: ChatUser[];
    initialConversationsWithMessages: Conversation[];
    initialBlockedUserIds: string[];
}

const ChatClient = ({ initialUsers, initialConversationsWithMessages, initialBlockedUserIds }: ChatClientProps) => {
    const { socket, loadingSocket } = useSocket();
    const { user, loadingUser } = useUser();
    const isMobile = useIsMobile();

    // UI State
    const [isChatCreationModalOpen, setChatCreationModalOpen] = useState(false);
    const [isMobileChatsSidebarOpen, setMobileChatsSidebarOpen] = useState(false);
    const [isMobileUsersSidebarOpen, setMobileUsersSidebarOpen] = useState(false);
    const [newConversationMode, setNewConversationMode] = useState('single');
    const [blockedUserIds, setBlockedUserIds] = useState<string[]>(initialBlockedUserIds);

    // Content handed off from the PWA share target (app/share-target/route.ts,
    // see ?shared= below) - held here until the user actually picks who to
    // share it with, since picking a conversation (getLastMessages) resets
    // messageToSend and would otherwise wipe it out if applied too early.
    const [pendingSharedContent, setPendingSharedContent] = useState<{ text?: string; file?: FileDTO } | null>(null);
    // Distinguishes the creation modal actually being used to pick a share
    // recipient (groupCreation -> onParticipantsSelected) from it being
    // cancelled - only the former should apply pendingSharedContent.
    const sharePickedRef = useRef(false);
    // getSharedContent is single-use (the token is deleted from Redis on
    // first read) - guards against firing it twice for the same token
    // (React Strict Mode's double effect invocation in development, or any
    // other re-run before the query param is cleared).
    const hasConsumedShareRef = useRef(false);
    const searchParams = useSearchParams();

    const { pendingClears, pendingClearsRef, setPendingClear, clearPendingClear } = usePendingCleanHistory(user?.email);

    const { conversationsForBar, updateConversationsBar } = useConversationsManager({
        initialConversations: initialConversationsWithMessages,
        pendingClears,
        pendingClearsRef,
    });

    const {
        chat,
        setChat,
        chatRef,
        messageToSend,
        setMessageToSend,
        currentConversationId,
        participants,
        getLastMessages,
        handleLeaveRoom,
        handleTyping,
        isLocalTypingRef,
        firstUnreadMessageId
    } = useChatRoom({
        socket,
        userEmail: user?.email,
        initialConversations: initialConversationsWithMessages,
        conversationsForBar: conversationsForBar,
        setMobileChatsSidebarOpen,
        setMobileUsersSidebarOpen,
        pendingClearsRef
    });

    // Message handling
    const { handleIncomingMessage, handleServerSavedMessageResponse, handleSendMessage } = useMessageHandling({
        socket,
        loadingSocket,
        userEmail: user?.email,
        currentConversationId,
        participants,
        chatRef,
        setChat,
        messageToSend,
        setMessageToSend,
        updateConversationsBar,
        pendingClearsRef
    });

    // Socket events
    const { chatListActiveUsers, typingUsers } = useSocketEvents({
        socket,
        loadingSocket,
        userEmail: user?.email,
        handleIncomingMessage,
        setChat,
        chatRef,
        isLocalTypingRef,
        currentConversationId,
    });


    // Service worker sync
    useServiceWorkerSync({
        handleServerSavedMessageResponse,
        setConversationsForBar: updateConversationsBar,
        onCleanHistorySynced: clearPendingClear,
        onCleanHistoryRejected: (conversationId: string) => {
            // The clear never actually applied server-side (write not
            // acknowledged, moderation/auth rejection, etc.) - stop hiding
            // history the server never agreed to hide. A full reload is the
            // simplest way to reliably bring the real history back, since
            // conversationsForBar's initial state doesn't resync itself from
            // a later router refresh once mounted.
            clearPendingClear(conversationId);
            window.location.reload();
        },
    });

    // Update message sender when user changes
    useEffect(() => {
        if (!socket || !user?.email) return;

        setMessageToSend(prev => ({
            ...prev,
            sender: user.email
        }));
    }, [socket, user?.email, setMessageToSend]);

    // Pick up content handed off by a PWA share (Android "Share to
    // WeCommunicate" from another app) - the redirect target is /chat?shared=
    // <token>, single-use and short-lived server-side (see shareActions.ts).
    useEffect(() => {
        // Wait for the user context's own initial load (UserProvider's
        // getUserObJFromCoockie, also a server action) to settle before
        // firing a second server action here - calling one during that
        // same initial-mount window was, empirically, causing the whole
        // client tree to spuriously remount partway through (losing
        // whatever state either call had just set), even though neither
        // call touches the other's data.
        if (loadingUser) return;

        const token = searchParams?.get('shared');
        if (!token || hasConsumedShareRef.current) return;
        hasConsumedShareRef.current = true;

        (async () => {
            const result = await getSharedContent(token);
            // Strip the query param either way, via the raw History API
            // rather than next/navigation's router.replace() - that
            // triggers a client-side re-navigation this app doesn't need
            // for a same-page cleanup, and stacks a redundant history entry.
            window.history.replaceState(null, '', '/chat');

            if (!result.success) {
                toast.error("That shared content couldn't be found - it may have expired.");
                return;
            }
            setPendingSharedContent({ text: result.text, file: result.file });
            setNewConversationMode('single');
            setChatCreationModalOpen(true);
            document.body.classList.add('overflow-hidden');
        })();
    }, [loadingUser]);

    // Clean up conversations with empty messages
    useEffect(() => {
        const messages = initialConversationsWithMessages.find(
            c => c._id === currentConversationId.current
        )?.messages;

        if (messages && messages.length === 0) {
            setChat([]);
            updateConversationsBar(null, "Clean", currentConversationId.current);
        }
    }, [initialConversationsWithMessages, currentConversationId, setChat, updateConversationsBar]);

    // The quote preview is built from the client's own already-rendered copy
    // of the message being replied to - the server re-derives the
    // authoritative sender/snippet from the DB when the reply is actually
    // saved (see MessageRepository.SaveMessage), so this is only ever used
    // for the sender's own optimistic preview, never trusted as-is.
    const handleReply = (message: Message) => {
        setMessageToSend(prev => ({
            ...prev,
            replyTo: {
                messageId: message._id!,
                sender: message.sender!,
                snippet: message.text || (message.file ? `sent file ${message.file.pathname}` : ''),
                hasFile: !!message.file
            }
        }));
    };

    // Optimistic - reverted if the server call fails, since a wrong "blocked"
    // state left showing would mean a message actually still sends (or vice
    // versa) without the UI reflecting it.
    const handleToggleBlock = async (targetUserId: string, shouldBlock: boolean) => {
        setBlockedUserIds(prev =>
            shouldBlock ? [...prev, targetUserId] : prev.filter(id => id !== targetUserId)
        );
        const result = shouldBlock ? await blockUser(targetUserId) : await unblockUser(targetUserId);
        if (!result.success) {
            setBlockedUserIds(prev =>
                shouldBlock ? prev.filter(id => id !== targetUserId) : [...prev, targetUserId]
            );
            toast.error(result.error || `Failed to ${shouldBlock ? 'block' : 'unblock'} user`);
            return;
        }
        // Presence is only ever recomputed server-side on connect/disconnect
        // (see socket/handlers.js's handleUpdateConnectedUsers) - a block
        // relationship changing doesn't fire either of those, so without
        // this nudge, a blocked user who's already online would keep seeing
        // the blocker's presence until their next reconnect. Reuses the
        // socket's own existing 'update connected users' refresh request
        // rather than a new event - the server recomputes and re-broadcasts
        // to every connected socket, correctly updating everyone's view.
        socket?.emit('update connected users');
    };

    // Modal handlers
    const handleOpenModal = (mode: string) => {
        setNewConversationMode(mode);
        setChatCreationModalOpen(true);
        document.body.classList.add("overflow-hidden");
    };

    // Fires only when the creation modal closes via an actual pick
    // (ChatCreationForm's groupCreation), never via Cancel - see
    // sharePickedRef's own comment.
    const handleParticipantsPicked = () => {
        sharePickedRef.current = true;
    };

    const handleCloseModal = async () => {
        if (participants.current) {
            await getLastMessages(participants.current);
            if (pendingSharedContent && sharePickedRef.current) {
                setMessageToSend(prev => ({
                    ...prev,
                    text: pendingSharedContent.text || prev.text,
                    file: pendingSharedContent.file || prev.file
                }));
            }
        }
        setPendingSharedContent(null);
        sharePickedRef.current = false;
        setChatCreationModalOpen(false);
        document.body.classList.remove("overflow-hidden");
    };

    if (!user || loadingUser) {
        return <Loading />;
    }

    return (
        <div className="viewport-between-bars flex overflow-hidden bg-linear-to-br bg-white dark:from-gray-900 dark:to-gray-800">
            <PushNotificationManager />

            <ConversationsBar
                isMobileChatsSidebarOpen={isMobileChatsSidebarOpen}
                handleOpenModal={handleOpenModal}
                getLastMessages={getLastMessages}
                initialRecentConversations={conversationsForBar}
                pendingClears={pendingClears}
            />

            <div className="flex min-w-0 flex-1 flex-col">
                <ChatHeader
                    setMobileChatsSidebarOpen={setMobileChatsSidebarOpen}
                    setMobileUsersSidebarOpen={setMobileUsersSidebarOpen}
                    participants={participants}
                    handleLeaveRoom={handleLeaveRoom}
                    chat={chat}
                    setChat={setChat}
                    conversationId={currentConversationId.current}
                    updateConversationsBar={updateConversationsBar}
                    typingUsers={typingUsers}
                    activeSocketUsers={chatListActiveUsers}
                    setPendingClear={setPendingClear}
                />

                <ChatWindow
                    messages={chat}
                    participants={participants}
                    isMobile={isMobile}
                    onReply={handleReply}
                    conversationId={currentConversationId.current}
                    firstUnreadMessageId={firstUnreadMessageId}
                    clearedAt={currentConversationId.current ? pendingClears[currentConversationId.current] : undefined}
                />

                {participants.current && (
                    <div className="shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-3 xl:p-4 shadow-lg z-15">
                        <ChatInputBar
                            message={messageToSend}
                            setMessage={setMessageToSend}
                            participants={participants}
                            handleSendMessage={handleSendMessage}
                            handleTyping={handleTyping}
                            isBlocked={participants.current.length === 1 && blockedUserIds.includes(participants.current[0]._id)}
                        />
                    </div>
                )}
            </div>

            <UsersList
                chatListActiveUsers={chatListActiveUsers}
                getLastMessages={getLastMessages}
                conversationId={currentConversationId.current}
                isMobileUsersSidebarOpen={isMobileUsersSidebarOpen}
                initialUsers={initialUsers}
                blockedUserIds={blockedUserIds}
                onToggleBlock={handleToggleBlock}
            />

            {isMobileChatsSidebarOpen && (
                <div
                    onClick={() => setMobileChatsSidebarOpen(false)}
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-16 xl:hidden transition-opacity"
                />
            )}

            {isMobileUsersSidebarOpen && (
                <div
                    onClick={() => setMobileUsersSidebarOpen(false)}
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-16 xl:hidden transition-opacity"
                />
            )}

            <ChatCreationForm
                isOpen={isChatCreationModalOpen}
                onClose={handleCloseModal}
                onParticipantsSelected={handleParticipantsPicked}
                title={pendingSharedContent ? 'Share to...' : undefined}
                participants={participants}
                conversationId={currentConversationId}
                setChat={setChat}
                conversationMode={newConversationMode}
                setMobileSidebarOpen={setMobileChatsSidebarOpen}
            />
        </div>
    );
};

export default ChatClient;
