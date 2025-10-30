'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { MessageSquareDiff } from 'lucide-react';
import { MessageCircle } from 'lucide-react';
import Message from '../types/message';
import MessageDTO from '../types/messageDTO';
import ChatUser from '../types/chatUser';
import MessageInput from '../components/messageInput';
import Buttons from '../components/buttons';
import UsersList from '../components/usersList';
import MessagesBox from '../components/messagesBox';
import Loading from '../components/loading';
import UploadFile from '../components/uploadFile';
import RecentConversationsPanel from '../components/recentConversationsPanel';
import GroupCreationForm from '../components/groupCreationForm';
import { AsShortName } from '../utils/asName';
import { useUser } from '../hooks/useUser';
import { useSocket } from '../hooks/useSocket';
import { useNotification } from '../hooks/useNotification';
import { saveMessage, getMessages } from '@/app/lib/chatActions'

const Chat = () => {

  const { socket, loadingSocket } = useSocket();
  const { user, loadingUser } = useUser();
  const [chat, setChat] = useState<Message[]>([]);
  const [messageToSend, setMessageToSend] = useState<Message>({ text: '' });
  const [chatListActiveUsers, setChatListActiveUsers] = useState<ChatUser[]>([]);
  const currentConversationId = useRef<string>("");
  const participants = useRef<ChatUser[] | null>(null);
  const chatBox = useRef<HTMLDivElement | null>(null);
  const [lastRecievedMessage, setLastRecievedMessage] = useState<Message>();
  const [isModalOpen, setModalOpen] = useState(false);

  const { increaseNotifications } = useNotification();
  const [reloadKey, setReloadKey] = useState(true);

  const pathname = usePathname();

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
      participantID: participants.current?.map(p => p._id!),
      conversationID: currentConversationId.current
    }));
  }, [socket])

  const handleIncomingMessage = useCallback(async (data: Message) => {
    if (data.sender?.toUpperCase() === user?.email!.toUpperCase()) return;
    if (data.conversationID === currentConversationId.current) {
      setChat((prevChat) => [...prevChat, { date: new Date(), sender: data.sender, text: data.text, file: data.file }]);
    }
    else {
      setReloadKey(prev => !prev);
      increaseNotifications(data.conversationID as string);
    }
    setLastRecievedMessage(data);
  }, [user?.email, increaseNotifications])


  const handleSendMessage = async () => {
    if (socket && !loadingSocket && participants.current?.length) {

      const newMessage: MessageDTO = {
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
        let newConversationId;
        if (!currentConversationId.current) {
          socket.disconnect();
          newConversationId = result.messageDoc.conversation;
          socket.io.opts.extraHeaders = { email: user!.email!, conversationId: newConversationId }
          socket.connect();
          currentConversationId.current = newConversationId;
        }

        socket.emit('chat message', newMessage);
        setMessageToSend((prev) => ({ ...prev, text: '', file: null }));
        setLastRecievedMessage({ ...messageToSend, conversationID: currentConversationId.current || newConversationId });
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
  }

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
      // ensure no duplicate handlers
      socket.off('update connected users', handler);
      socket.on('update connected users', handler);
      socket.emit('update connected users');
    };

    // attach now if already connected, otherwise wait for connect event
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
      socket?.on("chat message", handleIncomingMessage);
      return () => {
        socket?.off("chat message", handleIncomingMessage);
      };
    }
  }, [loadingSocket, user?.token]);

  useEffect(() => {
    if (chatBox.current)
      chatBox.current.scrollTop = chatBox.current.scrollHeight;
  }, [chat]);

  const handleOpenModal = () => {
    setModalOpen(true);
    document.body.classList.add("overflow-hidden");
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    document.body.classList.remove("overflow-hidden");
  };

  if (!user || loadingUser)
    return (<Loading />)

  return (
    <div className="grid md:grid-cols-4 gap-6 p-1 md:p-4 bg-linear-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="md:col-start-1 md:col-span-1 col-span-2">
        <button type="button"
          onClick={handleOpenModal}
          className="min-w-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 focus:bg-green-600 p-4 shadow
        bg-green-500 text-white py-5 rounded hover:bg-green-600 text-xl font-medium leading-none text-center flex items-center justify-between my-2">
          <h2 className="text-xl font-semibold text-white text-center flex-1">
            Create Group
          </h2>
          <MessageSquareDiff size={28} />
        </button>
        <GroupCreationForm
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          participants={participants}
          conversationId={currentConversationId}
          setChat={setChat} />
        <RecentConversationsPanel getLastMessages={getLastMessages} newMessage={lastRecievedMessage} participants={participants.current!} reloadKey={reloadKey} />
      </div>
      <div className="md:col-start-2 col-span-2">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 md:p-6">
          <h1 className="text-3xl font-bold text-center mb-2">
            Welcome, {' '}
            <span className="text-transparent bg-clip-text bg-linear-to-r from-amber-400 to-red-600">
              {AsShortName(user?.email as string)}
            </span>
          </h1>

          <div className="flex items-center justify-center space-x-2 text-gray-600 dark:text-gray-300">
            <MessageCircle size={32} />
            <p className="text-lg">
              {participants.current?.length! > 0 ? (
                <>
                  Chatting with:{" "}
                  {participants.current?.map((p, index) => (
                    <span key={index}>
                      {AsShortName(p.email!)}
                      {index < participants.current?.length! - 1 ? ", " : ""}
                    </span>
                  ))}
                </>
              ) : (
                "Please select a participant to chat with"
              )}
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
            <MessagesBox
              messages={chat}
              chatBox={chatBox}
              participants={participants.current!}
            />
          </div>

          {participants.current &&
            <UploadFile message={messageToSend} setMessage={setMessageToSend} />
          }

          <form action={handleSendMessage}>
            <div className="space-y-4">

              <MessageInput
                message={messageToSend}
                setMessage={setMessageToSend}
                participants={participants}
              />

              <Buttons
                handleLeaveRoom={handleLeaveRoom}
                chat={chat}
                setChat={setChat}
                message={messageToSend}
                conversationIdRef={currentConversationId}
                participants={participants}
              />
            </div>
          </form>
        </div>
      </div>

      <div className="grid md:justify-items-start md:col-span-1">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl
          md:flex items-end min-w-max p-6">
          <UsersList
            chatListActiveUsers={chatListActiveUsers}
            getLastMessages={getLastMessages}
            conversationId={currentConversationId.current}
          />
        </div>
      </div>
    </div>
  );
};

export default Chat;