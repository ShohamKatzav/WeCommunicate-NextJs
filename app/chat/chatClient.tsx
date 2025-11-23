'use client';
import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Message from '@/types/message';
import MessageDTO from '@/types/messageDTO';
import ChatUser from '@/types/chatUser';
import Conversation from '@/types/conversation';
import ChatInputBar from '../components/chatInputBar';
import ChatWindow from '../components/chatWindow';
import Loading from '../components/loading';
import ChatCreationForm from '../components/chatCreationForm';
import { useUser } from '../hooks/useUser';
import { useSocket } from '../hooks/useSocket';
import { useNotification } from '../hooks/useNotification';
import { useReloadConversationBar } from '../hooks/useReloadConversationBar';
import { saveMessage } from '@/app/lib/chatActions';
import useIsMobile from '../hooks/useIsMobile';
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
    const isMobile = useIsMobile();
    const { increaseNotifications } = useNotification();
    const { updateReloadKey } = useReloadConversationBar(); // reload for the conversations list
    const pathname = usePathname();
    const router = useRouter();

    const [chat, setChat] = useState<Message[]>([]);
    const [messageToSend, setMessageToSend] = useState<Message>({ text: '' });
    const [chatListActiveUsers, setChatListActiveUsers] = useState<ChatUser[]>([]);
    const [lastRecievedMessage, setLastRecievedMessage] = useState<Message>();
    const [isChatCreationModalOpen, setChatCreationModalOpen] = useState(false);
    const [isMobileChatsSidebarOpen, setMobileChatsSidebarOpen] = useState(false);
    const [isMobileUsersSidebarOpen, setMobileUsersSidebarOpen] = useState(false);
    const [newConversationMode, setNewConversationMode] = useState('single');


    const currentConversationId = useRef<string>("");
    const participants = useRef<ChatUser[] | null>(null);
    const chatBox = useRef<HTMLDivElement | null>(null);



    function findConversationByExactParticipants(
        conversations: Conversation[],
        participants: ChatUser[],
    ) {
        const targetIds = participants.map(p => p._id).sort();

        return conversations.find(conv => {
            const targetMembers = conv.members.filter(member => member.email?.toUpperCase() != user?.email?.toUpperCase());
            const convMembersIds = targetMembers
                .map(m => m._id)
                .sort();
            if (convMembersIds.length !== targetIds.length) return false;

            return convMembersIds.every((id, i) => id === targetIds[i]);
        });
    }
    async function getLastMessages(roomParticipants: ChatUser[]) {
        if (!roomParticipants) return;
        const conversation = findConversationByExactParticipants(initialConversationsWithMessages, roomParticipants);
        currentConversationId.current = conversation?._id ? conversation?._id : "";
        if (currentConversationId.current.length > 0) {
            setChat(conversation?.messages!);
        }
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

    const handleIncomingMessage = useCallback(async (data: Message) => {
        if (data.sender?.toUpperCase() === user?.email!.toUpperCase()) return;
        if (data.conversationID === currentConversationId.current) {
            setChat((prevChat) => {
                if (prevChat.some(msg => msg._id === data._id)) {
                    return prevChat;
                }
                return [...prevChat, {
                    _id: data._id,
                    date: data.date,
                    sender: data.sender,
                    text: data.text,
                    status: data.status,
                    file: data.file
                }];
            });
        }
        else {
            updateReloadKey();
            increaseNotifications(data.conversationID as string);
        }
        setLastRecievedMessage(data as Message);
    }, [user?.email, increaseNotifications]);

    const handleSendMessage = async () => {
        const tempId = new Date().getTime().toString();
        if (socket && !loadingSocket && participants.current?.length) {

            const newMessage: MessageDTO = {
                _id: tempId,
                date: new Date(),
                sender: messageToSend.sender || "",
                text: messageToSend.text?.trim(),
                file: messageToSend?.file || undefined,
                participantID: messageToSend.participantID || [],
                conversationID: messageToSend.conversationID || ""
            };
            setChat((prevChat) => [...prevChat, newMessage as Message]);

            try {
                const result = await saveMessage(newMessage);
                setChat(prevChat =>
                    prevChat.map(msg =>
                        msg._id === tempId ? result.messageDoc : msg
                    )
                );
                newMessage._id = result.messageDoc._id;
                let newConversationId;
                if (!currentConversationId.current) {
                    socket.disconnect();
                    newConversationId = result.messageDoc?.conversation;
                    socket.io.opts.extraHeaders = { email: user!.email!, conversationId: newConversationId }
                    socket.connect();
                    currentConversationId.current = newConversationId;
                }

                socket.emit('publish message', newMessage);
                setMessageToSend((prev) => ({ ...prev, text: '', file: null }));
                setLastRecievedMessage({ ...newMessage, conversationID: currentConversationId.current || newConversationId });
            } catch (error) {
                console.error("Error sending message:", error);
            }
        }
    };

    const handleLeaveRoom = async () => {
        socket?.emit('leave room', { conversationId: currentConversationId.current });
        currentConversationId.current = "";
        setChat([]);
        participants.current = null;
    };

    useEffect(() => {
        router.refresh();
    }, [chat]);

    useEffect(() => {
        if (!socket || loadingSocket) return;

        const handleMessageDeleted = (deletedMessage: Message) => {
            // Update chat state
            setChat(prevChat =>
                prevChat.map(msg =>
                    msg._id === deletedMessage._id
                        ? { ...msg, status: 'revoked' }
                        : msg
                )
            );
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
        if (!loadingSocket) {
            socket?.on("publish message", handleIncomingMessage);
            return () => {
                socket?.off("publish message", handleIncomingMessage);
            };
        }
    }, [loadingSocket, user?.token]);

    useLayoutEffect(() => {
        if (chatBox.current)
            chatBox.current.scrollTop = chatBox.current.scrollHeight;
    }, [chat]);

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
                initialRecentConversations={initialConversationsWithMessages}
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
                />

                { }
                <ChatWindow
                    messages={currentConversationId.current ? initialConversationsWithMessages.find(
                        c => c._id === currentConversationId.current)?.messages! : []}
                    participants={participants}
                    isMobile={isMobile} />

                {/* Input Area */}
                {
                    participants.current && (
                        <div className="sticky bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-3 md:p-4 shadow-lg z-15">
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