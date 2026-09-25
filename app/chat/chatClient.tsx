'use client';
import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useUser } from '../hooks/useUser';
import { useSocket } from '../hooks/useSocket';
import useIsMobile from '../hooks/useIsMobile';
import ChatUser from '@/types/chatUser';
import Conversation from '@/types/conversation';
import Message from '@/types/message';
import FileDTO from '@/types/FileDTO';
import { getSharedContent } from '../lib/shareActions';
import { takeChatReturn } from '../utils/chatReturn';
import { blockUser, unblockUser } from '../lib/blockActions';
import ChatInputBar from '../components/chat/chatInputBar';
import ChatWindow from '../components/chat/chatWindow';
import Loading from '../components/ui/loading';
import ChatCreationForm from '../components/chat/chatCreationForm';
import ConversationsBar from '../components/chat/conversationsBar';
import ChatHeader from '../components/chat/chatHeader';
import UsersList from '../components/people/usersList';
import PushNotificationManager from '../components/offline/pushNotificationManager';
import SamsungNotificationGuide from '../components/offline/samsungNotificationGuide';
import CallOverlay from '../components/chat/callOverlay';
import { useCall } from '../hooks/useCall';
import { CallPeer } from '../lib/callController';
import type { IceServerConfig } from '../lib/iceServers';
import { AsShortName } from '../utils/stringFormat';
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
    iceServers: IceServerConfig[];
}

// Only the open conversation's typers reach the header - one stable empty
// object for "nobody", rather than a new {} on every render.
const NO_TYPERS: Record<string, boolean> = {};

const ChatClient = ({ initialUsers, initialConversationsWithMessages, initialBlockedUserIds, iceServers }: ChatClientProps) => {
    const { socket, loadingSocket } = useSocket();
    const { user, loadingUser } = useUser();
    const t = useT();
    const router = useRouter();
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

    const { conversationsForBar, updateConversationsBar, setConversationsForBar } = useConversationsManager({
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
        ensureConversationId,
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
    const { handleIncomingMessage, handleCallRecord, handleServerSavedMessageResponse, handleSendMessage } = useMessageHandling({
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
    const { chatListActiveUsers, typingByConversation, lastSeenByEmail } = useSocketEvents({
        socket,
        loadingSocket,
        userEmail: user?.email,
        handleIncomingMessage,
        handleCallRecord,
        setChat,
        chatRef,
        isLocalTypingRef,
        currentConversationId,
    });

    // 1:1 calls. The caller's name and avatar come from data this page
    // already has - the invite itself only carries their email.
    const resolveCallPeer = (email: string): CallPeer => {
        const target = email.toLowerCase();
        const known = initialUsers.find(u => u.email?.toLowerCase() === target)
            ?? conversationsForBar.flatMap(c => c.members).find(m => m.email?.toLowerCase() === target);
        return { email, nickname: known?.nickname, avatarUrl: known?.avatarUrl };
    };

    // Answering from another conversation or the chat list opens the call's
    // conversation, so the call and its chat sit together.
    const openCallConversation = async (conversationId: string, peerEmail: string) => {
        const conversation = [...conversationsForBar, ...initialConversationsWithMessages]
            .find(c => c._id === conversationId);
        const others = conversation?.members
            .filter(m => m.email?.toLowerCase() !== user?.email?.toLowerCase()) ?? [];
        const roomParticipants = others.length > 0
            ? others
            : initialUsers.filter(u => u.email?.toLowerCase() === peerEmail.toLowerCase());
        if (roomParticipants.length > 0) await getLastMessages(roomParticipants);
    };

    const { call, controller: callController } = useCall({
        socket,
        userEmail: user?.email,
        getIceServers: () => iceServers,
        resolvePeer: resolveCallPeer,
        getCurrentConversationId: () => currentConversationId.current,
        openConversation: openCallConversation,
        onError: message => toast.error(message),
        t: () => t,
        onMissedCall: peer => toast(t("calls.missedFrom", { name: peer.nickname || AsShortName(peer.email) })),
    });

    // Switching to another conversation (or leaving this one) hangs up.
    // currentConversationId is a ref, so this checks after every render -
    // opening or leaving a room always re-renders via setChat.
    const lastConversationIdRef = useRef(currentConversationId.current);
    useEffect(() => {
        const conversationId = currentConversationId.current;
        const previousConversationId = lastConversationIdRef.current;
        if (conversationId === previousConversationId) return;
        lastConversationIdRef.current = conversationId;
        // An id-less chat getting its id (first message sent, or the existing
        // conversation found - see useChatRoom's getLastMessages) is the same
        // chat, not a switch. Leaving a call's conversation always passes
        // through a real id first, so nothing is missed by skipping these.
        if (!previousConversationId) return;
        callController?.conversationChanged(conversationId);
    });

    const handleStartCall = async (video: boolean) => {
        const other = participants.current?.length === 1 ? participants.current[0] : null;
        if (!other?.email) return;
        // A chat with no messages yet has no Conversation document - create
        // it now instead of leaving the call buttons disabled until someone
        // sends a first message.
        const conversationId = await ensureConversationId();
        if (!conversationId) {
            toast.error(t("calls.startFailed"));
            return;
        }
        callController?.startCall(
            { email: other.email, nickname: other.nickname, avatarUrl: other.avatarUrl },
            conversationId,
            video
        );
    };

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
                toast.error(t("chat.shareNotFound"));
                return;
            }
            setPendingSharedContent({ text: result.text, file: result.file });
            setNewConversationMode('single');
            setChatCreationModalOpen(true);
            document.body.classList.add('overflow-hidden');
        })();
    }, [loadingUser]);

    // Back from another user's profile reopens the conversation that was
    // open when they left (see utils/chatReturn.ts). Waits for the user load
    // (the same remount hazard as the share pickup above) and for the socket,
    // since getLastMessages joins the room through it and nothing re-joins
    // a room opened before the socket existed.
    const hasRestoredRoomRef = useRef(false);
    useEffect(() => {
        if (loadingUser || loadingSocket || hasRestoredRoomRef.current) return;
        hasRestoredRoomRef.current = true;
        const room = takeChatReturn();
        if (room) getLastMessages(room.participants);
    }, [loadingUser, loadingSocket, getLastMessages]);

    // Someone in one of this user's conversations deleted their account
    // (notifyAccountDeleted in socket/handlers.ts): swap them for "Deleted
    // account" in the list and in the open chat, and show the notice the
    // server left - the same thing a reload would show.
    useEffect(() => {
        if (!socket) return;
        const onMemberAccountDeleted = (data: { conversationID?: string; deletedMemberId?: string; message?: Message }) => {
            const { conversationID, deletedMemberId, message } = data ?? {};
            if (!conversationID || !deletedMemberId || !message?._id) return;
            const placeholder = { _id: deletedMemberId, deleted: true } as ChatUser;
            const swap = (members: ChatUser[]) => [...members.filter(m => m._id !== deletedMemberId), placeholder];

            setConversationsForBar(prev => prev.map(c => c._id === conversationID ? { ...c, members: swap(c.members) } : c));
            if (participants.current?.some(p => p._id === deletedMemberId)) {
                participants.current = swap(participants.current);
            }
            if (conversationID === currentConversationId.current && !chatRef.current.some(m => m._id === message._id)) {
                setChat([...chatRef.current, message].sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime()));
                socket.emit('message read', { conversationId: conversationID });
            }
            updateConversationsBar(message);
        };
        socket.on('member account deleted', onMemberAccountDeleted);
        return () => { socket.off('member account deleted', onMemberAccountDeleted); };
    }, [socket, setConversationsForBar, participants, currentConversationId, chatRef, setChat, updateConversationsBar]);

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
                snippet: message.text || '',
                hasFile: !!message.file,
                hasLocation: !!message.location
            }
        }));
    };

    // Optimistic - reverted if the server call fails, since a wrong "blocked"
    // state left showing would mean a message actually still sends (or vice
    // versa) without the UI reflecting it.
    const handleToggleBlock = async (targetUserId: string, shouldBlock: boolean) => {
        // A call with someone you're blocking ends right away. The server
        // ends it too (on the 'update connected users' emit below), which
        // is what covers a block made from another tab or device.
        const targetEmail = initialUsers.find(u => u._id === targetUserId)?.email?.toLowerCase();
        if (shouldBlock && targetEmail && call.peer?.email.toLowerCase() === targetEmail) {
            callController?.hangUp();
        }
        setBlockedUserIds(prev =>
            shouldBlock ? [...prev, targetUserId] : prev.filter(id => id !== targetUserId)
        );
        const result = shouldBlock ? await blockUser(targetUserId) : await unblockUser(targetUserId);
        if (!result.success) {
            setBlockedUserIds(prev =>
                shouldBlock ? prev.filter(id => id !== targetUserId) : [...prev, targetUserId]
            );
            toast.error(result.error || (shouldBlock ? t("chat.blockFailed") : t("chat.unblockFailed")));
            return;
        }
        // Presence is only ever recomputed server-side on connect/disconnect
        // (see socket/handlers.ts's handleUpdateConnectedUsers) - a block
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

    // Same signal as the profile pages: a session is the token, not a
    // truthy user object. getCurrentUser() resolves to {} when the cookie
    // is missing, and a failed fetch sets user to null. Either one used to
    // sit on this spinner forever, because nothing sent the tab to /login.
    useEffect(() => {
        if (!loadingUser && !user?.token) {
            router.replace('/login');
        }
    }, [loadingUser, user?.token, router]);

    if (loadingUser || !user?.token) {
        return <Loading />;
    }

    // Blocking is scoped to 1:1 conversations (see chatActions.saveMessage) -
    // it gates both sending and, in the header, whether the other person's
    // last seen is shown at all.
    const isCurrentChatBlocked = participants.current?.length === 1
        && blockedUserIds.includes(participants.current[0]._id);
    // A 1:1 whose other person deleted their account stays readable, but
    // there's no one left to send to.
    const isCurrentChatRecipientDeleted = participants.current?.length === 1
        && !!participants.current[0].deleted;

    return (
        <div className="viewport-between-bars flex overflow-hidden bg-linear-to-br bg-white dark:from-gray-900 dark:to-gray-800">
            <PushNotificationManager />
            <SamsungNotificationGuide />

            <ConversationsBar
                isMobileChatsSidebarOpen={isMobileChatsSidebarOpen}
                handleOpenModal={handleOpenModal}
                getLastMessages={getLastMessages}
                initialRecentConversations={conversationsForBar}
                pendingClears={pendingClears}
            />

            <div className="relative flex min-w-0 flex-1 flex-col">
                <ChatHeader
                    setMobileChatsSidebarOpen={setMobileChatsSidebarOpen}
                    setMobileUsersSidebarOpen={setMobileUsersSidebarOpen}
                    participants={participants}
                    handleLeaveRoom={handleLeaveRoom}
                    chat={chat}
                    setChat={setChat}
                    conversationId={currentConversationId.current}
                    updateConversationsBar={updateConversationsBar}
                    typingUsers={typingByConversation[currentConversationId.current] ?? NO_TYPERS}
                    activeSocketUsers={chatListActiveUsers}
                    setPendingClear={setPendingClear}
                    lastSeenByEmail={lastSeenByEmail}
                    isBlocked={isCurrentChatBlocked}
                    onStartCall={handleStartCall}
                    ensureConversationId={ensureConversationId}
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
                            isBlocked={isCurrentChatBlocked}
                            recipientDeleted={isCurrentChatRecipientDeleted}
                        />
                    </div>
                )}

                {/* Covers this column only while a call is on; an incoming
                    call renders as a floating card instead, so it shows on
                    top of whatever conversation or list is open. */}
                <CallOverlay call={call} controller={callController} />
            </div>

            <UsersList
                chatListActiveUsers={chatListActiveUsers}
                getLastMessages={getLastMessages}
                conversationId={currentConversationId.current}
                isMobileUsersSidebarOpen={isMobileUsersSidebarOpen}
                initialUsers={initialUsers}
                blockedUserIds={blockedUserIds}
                onToggleBlock={handleToggleBlock}
                lastSeenByEmail={lastSeenByEmail}
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
                title={pendingSharedContent ? t("chat.create.shareTo") : undefined}
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
