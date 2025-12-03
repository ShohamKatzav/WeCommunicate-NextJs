'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useUser } from '../hooks/useUser';
import { useSocket } from '../hooks/useSocket';
import { useNotification } from '../hooks/useNotification';
import useIsMobile from '../hooks/useIsMobile';
import { saveMessage, revalidateChatRoute, getConversationMembers } from '@/app/lib/chatActions';
import Message from '@/types/message';
import MessageDTO from '@/types/messageDTO';
import ChatUser from '@/types/chatUser';
import Conversation from '@/types/conversation';
import ChatInputBar from '../components/chatInputBar';
import ChatWindow from '../components/chatWindow';
import Loading from '../components/loading';
import ChatCreationForm from '../components/chatCreationForm';
import ConversationsBar from '../components/conversationsBar';
import ChatHeader from '../components/chatHeader';
import UsersList from '../components/usersList';

interface ChatClientProps {
    initialUsers: ChatUser[]; // Pre-fetched users from server
    initialConversationsWithMessages: Conversation[];
}

const ChatClient = ({ initialUsers, initialConversationsWithMessages }: ChatClientProps) => {

    const { socket, loadingSocket } = useSocket();
    const { user, loadingUser } = useUser();
    const { increaseNotifications } = useNotification();
    const isMobile = useIsMobile();
    const pathname = usePathname();

    const [chat, setChat] = useState<Message[]>([]);
    const [messageToSend, setMessageToSend] = useState<Message>({ text: '' });
    const [chatListActiveUsers, setChatListActiveUsers] = useState<ChatUser[]>([]);
    const [lastRecievedMessage, setLastRecievedMessage] = useState<Message>();
    const [isChatCreationModalOpen, setChatCreationModalOpen] = useState(false);
    const [isMobileChatsSidebarOpen, setMobileChatsSidebarOpen] = useState(false);
    const [isMobileUsersSidebarOpen, setMobileUsersSidebarOpen] = useState(false);
    const [newConversationMode, setNewConversationMode] = useState('single');
    const [conversationsForBar, setConversationsForBar] = useState<Conversation[]>(initialConversationsWithMessages);

    const currentConversationId = useRef<string>("");
    const participants = useRef<ChatUser[] | null>(null);
    const chatRef = useRef<Message[]>(chat);

    function findConversationByExactParticipants(
        conversations: Conversation[],
        participants: ChatUser[],
    ) {
        const targetIds = participants.map(p => p._id).sort();

        return conversations.find(conv => {
            const targetMembers = conv.members.filter(member =>
                member.email?.toUpperCase() != user?.email?.toUpperCase()
            );
            const convMembersIds = targetMembers
                .map(m => m._id)
                .sort();
            if (convMembersIds.length !== targetIds.length) return false;

            return convMembersIds.every((id, i) => id === targetIds[i]);
        });
    }
    async function getLastMessages(roomParticipants: ChatUser[]) {
        if (!roomParticipants) return;
        if (currentConversationId.current)
            socket?.emit('leave room', { conversationId: currentConversationId.current });
        const conversation = findConversationByExactParticipants(initialConversationsWithMessages, roomParticipants);
        currentConversationId.current = conversation?._id ? conversation?._id : "";
        socket?.emit('join room', { conversationId: currentConversationId.current });
        setChat(conversation?.messages?.sort((a: Message, b: Message) =>
            new Date(a.date!).getTime() - new Date(b.date!).getTime()) || []);
        participants.current = roomParticipants;
        setMessageToSend(prev => ({
            ...prev,
            value: '',
            participantID: roomParticipants?.map(p => p._id!),
            conversationID: currentConversationId.current
        }));
        setMobileChatsSidebarOpen(false);
        setMobileUsersSidebarOpen(false);
    };

    const handleIncomingMessage = useCallback((data: Message) => {
        if (data.sender?.toUpperCase() === user?.email!.toUpperCase()) return;
        if (data.conversationID?.toUpperCase() === currentConversationId.current.toUpperCase()) {
            setChat(prev => {
                const updated = [...prev, data];
                updated.sort((a: Message, b: Message) => new Date(a.date!).getTime() - new Date(b.date!).getTime());
                return updated;
            });
        }
        else {
            increaseNotifications(data.conversationID as string);
        }
        setLastRecievedMessage(data as Message);
        updateConversationsBar(data);
    }, [user?.email, increaseNotifications]);

    const handleServerSavedMessageResponse = (async (savedMessage: any, tempId: string) => {
        const tempMessage = chatRef.current.find(
            msg => msg._id?.toUpperCase() === tempId.toUpperCase()
        );

        if (!tempMessage) {
            console.warn("Temp message not found:", tempId);
            return;
        }

        const messageDoc = savedMessage.messageDoc || savedMessage;

        setChat(prevChat =>
            prevChat.map(msg =>
                msg._id === tempMessage._id ? messageDoc : msg
            )
        );
        tempMessage._id = messageDoc._id;

        let newConversationId;

        if (!currentConversationId.current) {
            newConversationId = messageDoc?.conversation;
            currentConversationId.current = newConversationId;

            socket?.emit('join room', { conversationId: newConversationId });
            await revalidateChatRoute();
        }

        const messageToEmit = {
            ...messageDoc,
            conversationID: messageDoc.conversation || currentConversationId.current
        };

        socket?.emit('publish message', messageToEmit);

        const finalMessage = {
            ...messageDoc,
            conversationID: currentConversationId.current || newConversationId
        };

        setLastRecievedMessage(finalMessage);
        updateConversationsBar(finalMessage);

    });

    const handleSendMessage = async () => {
        const tempId = new Date().getTime().toString();
        if (socket && !loadingSocket && participants.current?.length) {

            const newTempMessage: MessageDTO = {
                _id: tempId,
                date: new Date(),
                sender: messageToSend.sender || "",
                text: messageToSend.text?.trim(),
                file: messageToSend?.file || undefined,
                participantID: messageToSend.participantID || [],
                conversationID: messageToSend.conversationID || ""
            };
            setMessageToSend(prev => ({ ...prev, text: '', file: null }));
            setChat((prevChat) => [...prevChat, newTempMessage as Message]);

            try {
                const result = await saveMessage(newTempMessage);
                await handleServerSavedMessageResponse(result, tempId);
            } catch (error) {
                alert("Could not complete the operation now. The message will be sent when the connection is restored.");
            }
        }
    };

    const updateConversationsBar = async (message: Message | null, mode: string = "", cleanId?: string) => {
        if (mode === "Clean" && cleanId) {
            setConversationsForBar(prev => {
                let updated = [...prev];

                const idx = updated.findIndex(
                    c => c._id?.toUpperCase() === cleanId.toUpperCase()
                );
                if (idx !== -1) {
                    const conv = { ...updated[idx], messages: [] };
                    updated.splice(idx, 1);
                    updated.unshift(conv);
                }
                return updated;
            })
            return;
        }
        else if (mode === "Delete") {
            console.log(currentConversationId.current);
            setConversationsForBar(prev => {
                if (!currentConversationId.current) return prev;
                return prev.filter(
                    c => c._id?.toUpperCase() !== currentConversationId.current.toUpperCase()
                );
            });
            return;
        }
        else {
            setConversationsForBar(prevConversations => {
                if (!message) return prevConversations;
                const updatedConversations = [...prevConversations];
                const conversationIndex = updatedConversations.findIndex(
                    conv => conv._id?.toUpperCase() === message.conversationID?.toUpperCase()
                );

                if (conversationIndex > -1) {
                    // Move conversation to top with new message
                    const [conversation] = updatedConversations.splice(conversationIndex, 1);
                    if (!conversation.messages?.some(m => m._id === message._id)) {
                        conversation.messages = [...(conversation.messages || []), message];
                    }
                    updatedConversations.unshift(conversation);
                } else {
                    // New conversation - fetch members from server
                    const newConversation: Conversation = {
                        _id: message.conversationID!,
                        members: [],
                        messages: [message],
                    };
                    updatedConversations.unshift(newConversation);

                    // Fetch members in the next tick
                    queueMicrotask(async () => {
                        const result = await getConversationMembers(message.conversationID!);
                        if (result.success) {
                            setConversationsForBar(prev =>
                                prev.map(conv =>
                                    conv._id === message.conversationID
                                        ? { ...conv, members: result.members }
                                        : conv
                                )
                            );
                        }
                    });
                }
                return updatedConversations;
            });
        }
    };

    const handleLeaveRoom = async () => {
        socket?.emit('leave room', { conversationId: currentConversationId.current });
        currentConversationId.current = "";
        setChat([]);
        participants.current = null;
    };

    useEffect(() => {
        chatRef.current = chat;
    }, [chat]);

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            const swListener = async (event: any) => {

                if (event.data.type === 'CONVERSATION_DELETED_QUEUED') {
                    setConversationsForBar(prev =>
                        prev.filter(c =>
                            c._id?.toUpperCase() !== event.data.id.toUpperCase()
                        )
                    );
                    return;
                }

                if (event.data.type === 'MESSAGE_SYNCED') {
                    const { savedMessage, tempId } = event.data;
                    await handleServerSavedMessageResponse(
                        savedMessage,
                        tempId
                    );
                }
            };

            navigator.serviceWorker.addEventListener('message', swListener);
            return () =>
                navigator.serviceWorker.removeEventListener('message', swListener);
        }
    }, []);

    useEffect(() => {
        const messages = initialConversationsWithMessages.find(c => c._id === currentConversationId.current)?.messages;
        if (messages && messages.length === 0) {
            setChat([]);
            updateConversationsBar(null, "Clean", currentConversationId.current);
        }
    }, [initialConversationsWithMessages]);

    useEffect(() => {
        if (!socket || loadingSocket) return;
        const handleMessageDeleted = async (deletedMessage: Message) => {
            setChat(prevChat =>
                prevChat.map(msg =>
                    msg._id === deletedMessage._id
                        ? { ...msg, status: 'revoked' }
                        : msg
                )
            );
            try {
                await revalidateChatRoute();
            } catch (error) {
                console.error("Error revalidating chat route:", error);
            }
        };

        socket.on("delete message", handleMessageDeleted);

        return () => {
            socket.off("delete message", handleMessageDeleted);
        };
    }, [socket, loadingSocket]);

    useEffect(() => {
        if (!socket || !(user?.email)) return;

        setMessageToSend(prev => ({
            ...prev,
            sender: user.email
        }));

    }, [socket, user?.email]);

    useEffect(() => {
        if (!socket) return;

        const handler = (data: ChatUser[]) => {
            setChatListActiveUsers(data);
        };

        const onConnect = () => {
            socket.off('update connected users', handler);
            socket.on('update connected users', handler);
            socket.emit('update connected users');
        };

        try {
            if (!loadingSocket) {
                onConnect();
            } else {
                socket.off('connect', onConnect);
                socket.on('connect', onConnect);
            }
        } catch (e) {
            console.error('[client] socket attach error', e);
        }

        return () => {
            socket.off('connect', onConnect);
            socket.off('update connected users', handler);
        };
    }, [socket, pathname]);

    useEffect(() => {
        if (!socket || loadingSocket || !socket.connected) return;

        const handlePublish = (data: Message) => {
            handleIncomingMessage(data);
        };

        socket.on("publish message", handlePublish);

        return () => {
            socket.off("publish message", handlePublish);
        };
    }, [socket, loadingSocket, socket?.connected, handleIncomingMessage]);

    const handleOpenModal = (mode: string) => {
        setNewConversationMode(mode);
        setChatCreationModalOpen(true);
        document.body.classList.add("overflow-hidden");
    };

    const handleCloseModal = () => {
        if (participants.current)
            getLastMessages(participants.current);
        setChatCreationModalOpen(false);
        document.body.classList.remove("overflow-hidden");
    };

    if (!user || loadingUser)
        return (<Loading />);

    return (
        <div className="h-[85dvh] flex bg-linear-to-br bg-white dark:from-gray-900 dark:to-gray-800">
            <ConversationsBar
                isMobileChatsSidebarOpen={isMobileChatsSidebarOpen}
                handleOpenModal={handleOpenModal}
                getLastMessages={getLastMessages}
                lastRecievedMessage={lastRecievedMessage}
                participants={participants}
                initialRecentConversations={conversationsForBar}
            />

            <div className="flex flex-1 flex-col" >
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
                    isMobile={isMobile} />

                {/* Input Area */}
                {
                    participants.current && (
                        <div className="sticky bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-3 md:p-4 shadow-lg z-15 mb-4">
                            <ChatInputBar
                                message={messageToSend}
                                setMessage={setMessageToSend}
                                participants={participants}
                                handleSendMessage={handleSendMessage}
                            />
                        </div>
                    )
                }
            </div >
            {/* LEFT SIDEBAR - Conversations */}
            <UsersList
                chatListActiveUsers={chatListActiveUsers}
                getLastMessages={getLastMessages}
                conversationId={currentConversationId.current}
                isMobileUsersSidebarOpen={isMobileUsersSidebarOpen}
                initialUsers={initialUsers} />

            {/* Mobile Sidebar Overlay */}
            {
                isMobileChatsSidebarOpen && (
                    <div
                        onClick={() => setMobileChatsSidebarOpen(false)}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-16 md:hidden transition-opacity"
                    />
                )
            }
            {
                isMobileUsersSidebarOpen && (
                    <div
                        onClick={() => setMobileUsersSidebarOpen(false)}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-16 md:hidden transition-opacity"
                    />
                )
            }

            <ChatCreationForm
                isOpen={isChatCreationModalOpen}
                onClose={handleCloseModal}
                participants={participants}
                conversationId={currentConversationId}
                setChat={setChat}
                conversationMode={newConversationMode}
                setMobileSidebarOpen={setMobileChatsSidebarOpen}
            />
        </div >
    );
};

export default ChatClient;