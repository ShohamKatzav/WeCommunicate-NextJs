'use client';
import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Message from '@/types/message';
import MessageDTO from '@/types/messageDTO';
import ChatUser from '@/types/chatUser';
import ChatInputBar from '../components/chatInputBar';
import ChatWindow from '../components/chatWindow';
import Loading from '../components/loading';
import ChatCreationForm from '../components/chatCreationForm';
import { useUser } from '../hooks/useUser';
import { useSocket } from '../hooks/useSocket';
import { useNotification } from '../hooks/useNotification';
import { saveMessage, getMessages } from '@/app/lib/chatActions';
import useIsMobile from '../hooks/useIsMobile';
import UsersList from '../components/usersList';
import ConversationsBar from '../components/conversationsBar';
import ChatHeader from '../components/chatHeader';

const Chat = () => {
    const { socket, loadingSocket } = useSocket();
    const { user, loadingUser } = useUser();
    const isMobile = useIsMobile();

    const [chat, setChat] = useState<Message[]>([]);
    const [messageToSend, setMessageToSend] = useState<Message>({ text: '' });
    const [chatListActiveUsers, setChatListActiveUsers] = useState<ChatUser[]>([]);
    const currentConversationId = useRef<string>("");
    const participants = useRef<ChatUser[] | null>(null);
    const chatBox = useRef<HTMLDivElement | null>(null);
    const usersRefreshRef = useRef<(() => void) | null>(null);
    const [lastRecievedMessage, setLastRecievedMessage] = useState<Message>();
    const [isModalOpen, setModalOpen] = useState(false);
    const [isMobileChatsSidebarOpen, setMobileChatsSidebarOpen] = useState(false);
    const [isMobileUsersSidebarOpen, setMobileUsersSidebarOpen] = useState(false);

    const { increaseNotifications } = useNotification();
    const [reloadKey, setReloadKey] = useState(true); // reload for the conversations list

    const pathname = usePathname();
    const [newConversationMode, setNewConversationMode] = useState('single');


    interface getMessagesResponse {
        success: boolean,
        message: string,
        chat: Message[],
        conversation: string | null
    }

    const getLastMessages = useCallback(async (roomParticipants: ChatUser[]) => {
        if (!roomParticipants) return;
        await socket?.emit('leave room', { conversationId: currentConversationId });
        const response: getMessagesResponse = await getMessages(roomParticipants.map(p => p._id), 1);
        await socket?.emit('join room', { conversationId: response.conversation });
        const chatWithFormattedDates: any = response?.chat?.length ? response.chat?.map((message: Message) =>
            ({ ...message, date: new Date(message.date!).toLocaleString() })) : [];
        currentConversationId.current = response.conversation as string;
        setChat(chatWithFormattedDates);
        participants.current = roomParticipants;
        setMessageToSend(prev => ({
            ...prev,
            value: '',
            participantID: roomParticipants?.map(p => p._id!),
            conversationID: currentConversationId.current
        }));
        setMobileChatsSidebarOpen(false);
        setMobileUsersSidebarOpen(false);
    }, [socket]);

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
            setReloadKey(prev => !prev);
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
        currentConversationId.current = "";
        await socket?.emit('leave room', { conversationId: currentConversationId });
        setChat([]);
        participants.current = null;
    };

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
        setModalOpen(true);
        document.body.classList.add("overflow-hidden");
    };

    const handleCloseModal = () => {
        getLastMessages(participants.current || []);
        setModalOpen(false);
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
                participants={participants.current}
                reloadKey={reloadKey}
            />

            < div className="flex flex-1 flex-col" >
                <ChatHeader
                    setMobileChatsSidebarOpen={setMobileChatsSidebarOpen}
                    setMobileUsersSidebarOpen={setMobileUsersSidebarOpen}
                    participants={participants}
                    handleLeaveRoom={handleLeaveRoom}
                    chat={chat}
                    setChat={setChat}
                    conversationId={currentConversationId.current}
                    setReloadKey={setReloadKey}
                />

                <ChatWindow
                    messages={chat}
                    setReloadKey={setReloadKey}
                    participants={participants} isMobile={isMobile} />

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
                registerRefresh={(fn) => { usersRefreshRef.current = fn; }}
            />

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
                isOpen={isModalOpen}
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

export default Chat;