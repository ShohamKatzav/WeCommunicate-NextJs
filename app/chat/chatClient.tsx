'use client';
import { useEffect, useState } from 'react';
import { useUser } from '../hooks/useUser';
import { useSocket } from '../hooks/useSocket';
import { useNotification } from '../hooks/useNotification';
import useIsMobile from '../hooks/useIsMobile';
import Message from '@/types/message';
import ChatUser from '@/types/chatUser';
import Conversation from '@/types/conversation';
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

interface ChatClientProps {
    initialUsers: ChatUser[];
    initialConversationsWithMessages: Conversation[];
}

const ChatClient = ({ initialUsers, initialConversationsWithMessages }: ChatClientProps) => {
    const { socket, loadingSocket } = useSocket();
    const { user, loadingUser } = useUser();
    const { increaseNotifications } = useNotification();
    const isMobile = useIsMobile();

    // UI State
    const [isChatCreationModalOpen, setChatCreationModalOpen] = useState(false);
    const [isMobileChatsSidebarOpen, setMobileChatsSidebarOpen] = useState(false);
    const [isMobileUsersSidebarOpen, setMobileUsersSidebarOpen] = useState(false);
    const [newConversationMode, setNewConversationMode] = useState('single');
    const [messageToPush, setMessageToPush] = useState<Message>({ text: '' });
    const [lastReceivedMessage, setLastReceivedMessage] = useState<Message>();

    // Chat room management
    const {
        chat,
        setChat,
        chatRef,
        messageToSend,
        setMessageToSend,
        currentConversationId,
        participants,
        getLastMessages,
        handleLeaveRoom
    } = useChatRoom({
        socket,
        userEmail: user?.email,
        initialConversations: initialConversationsWithMessages,
        setMobileChatsSidebarOpen,
        setMobileUsersSidebarOpen
    });

    // Conversations management
    const { conversationsForBar, updateConversationsBar } = useConversationsManager({
        initialConversations: initialConversationsWithMessages,
        currentConversationId
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
        increaseNotifications,
        setLastReceivedMessage,
        setMessageToPush,
        updateConversationsBar
    });

    // Socket events
    const { chatListActiveUsers } = useSocketEvents({
        socket,
        loadingSocket,
        userEmail: user?.email,
        handleIncomingMessage,
        setChat,
        chatRef
    });


    // Service worker sync
    useServiceWorkerSync({
        handleServerSavedMessageResponse,
        setConversationsForBar: updateConversationsBar,
    });

    // Update message sender when user changes
    useEffect(() => {
        if (!socket || !user?.email) return;

        setMessageToSend(prev => ({
            ...prev,
            sender: user.email
        }));
    }, [socket, user?.email, setMessageToSend]);

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

    // Modal handlers
    const handleOpenModal = (mode: string) => {
        setNewConversationMode(mode);
        setChatCreationModalOpen(true);
        document.body.classList.add("overflow-hidden");
    };

    const handleCloseModal = () => {
        if (participants.current) {
            getLastMessages(participants.current);
        }
        setChatCreationModalOpen(false);
        document.body.classList.remove("overflow-hidden");
    };

    if (!user || loadingUser) {
        return <Loading />;
    }

    return (
        <div className="h-[85dvh] flex bg-linear-to-br bg-white dark:from-gray-900 dark:to-gray-800">
            <PushNotificationManager
                message={messageToPush}
                activeSocketUsers={chatListActiveUsers}
            />

            <ConversationsBar
                isMobileChatsSidebarOpen={isMobileChatsSidebarOpen}
                handleOpenModal={handleOpenModal}
                getLastMessages={getLastMessages}
                lastRecievedMessage={lastReceivedMessage}
                participants={participants}
                initialRecentConversations={conversationsForBar}
            />

            <div className="flex flex-1 flex-col">
                <ChatHeader
                    setMobileChatsSidebarOpen={setMobileChatsSidebarOpen}
                    setMobileUsersSidebarOpen={setMobileUsersSidebarOpen}
                    participants={participants}
                    handleLeaveRoom={handleLeaveRoom}
                    chat={chat}
                    setChat={setChat}
                    conversationId={currentConversationId.current}
                    updateConversationsBar={updateConversationsBar}
                />

                <ChatWindow
                    messages={chat}
                    participants={participants}
                    isMobile={isMobile}
                />

                {participants.current && (
                    <div className="sticky bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-3 md:p-4 shadow-lg z-15 mb-4">
                        <ChatInputBar
                            message={messageToSend}
                            setMessage={setMessageToSend}
                            participants={participants}
                            handleSendMessage={handleSendMessage}
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
            />

            {isMobileChatsSidebarOpen && (
                <div
                    onClick={() => setMobileChatsSidebarOpen(false)}
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-16 md:hidden transition-opacity"
                />
            )}

            {isMobileUsersSidebarOpen && (
                <div
                    onClick={() => setMobileUsersSidebarOpen(false)}
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-16 md:hidden transition-opacity"
                />
            )}

            <ChatCreationForm
                isOpen={isChatCreationModalOpen}
                onClose={handleCloseModal}
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