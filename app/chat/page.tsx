'use client';
import { memo, useEffect, useRef, useState } from 'react';
import AxiosWithAuth from '../utils/axiosWithAuth';
import Message from '../types/message';
import ChatUser from '../types/chatUser';
import MessageInput from '../components/messageInput';
import Buttons from '../components/buttons';
import UsersList from '../components/usersList';
import { useSocket } from '../hooks/useSocket';
import fetchMessages from '../actions/message-actions';
import MessagesBox from '../components/messagesBox';
import AuthGuard from '../guards/protected-page';
import { AsShortName } from '../utils/asName';
import { useNotification } from '../hooks/useNotification';
import RecentConversationsPanel from '../components/recentConversationsPanel';
import GroupCreationForm from '../components/groupCreationForm';
import { MessageSquareDiff } from 'lucide-react';
import { MessageCircle } from 'lucide-react';

const Chat = (props: any) => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_ADDRESS + "api/chat";
  const { socket, loadingSocket } = useSocket();
  const [chat, setChat] = useState<Message[]>([]);
  const [message, setMessage] = useState<Message>({ date: undefined, sender: '', value: '' });
  const [chatListActiveUsers, setChatListActiveUsers] = useState<ChatUser[]>([]);
  const currentConversationId = useRef<string>();
  const participants = useRef<ChatUser[] | null>();
  const chatBox = useRef<HTMLDivElement>(null);
  const [newMessage, setNewMessage] = useState<Message>();
  const [isModalOpen, setModalOpen] = useState(false);

  const { increaseNotifications } = useNotification();

  const getLastMessages = async (roomParticipants: ChatUser[]) => {
    await socket?.emit('leave room', { conversationId: currentConversationId });
    const response = await fetchMessages(1, roomParticipants.map(p => p._id!));
    await socket?.emit('join room', { conversationId: response.conversation });
    const chatWithFormattedDates = response?.chat?.length ? response.chat?.map((message: Message) =>
      ({ ...message, date: new Date(message.date!).toLocaleString() })) : [];
    currentConversationId.current = response.conversation;
    setChat(chatWithFormattedDates);
    participants.current = roomParticipants;
  }

  const handleIncomingMessage = (data: Message) => {
    if (data.conversationID === currentConversationId.current) {
      if (data.sender?.toUpperCase() !== props.user?.email.toUpperCase()) {
        setChat((prevChat) => [...prevChat, { date: new Date(), sender: data.sender, value: data.value }]);
      }
    }
    else
      increaseNotifications(data.conversationID as string);
    setNewMessage(data);
  }

  const updateUsersList = (data: ChatUser[]) => {
    setChatListActiveUsers(data);
  };

  const handleSendMessage = async () => {
    if (socket && participants.current?.length) {
      const newMessage: Message = {
        date: new Date(),
        sender: props.user?.email,
        participantID: participants.current.map(p => p._id!),
        value: message.value?.trim(),
        conversationID: currentConversationId.current
      };

      setChat((prevChat) => [...prevChat, newMessage]);

      try {
        const result = await AxiosWithAuth().post(`${baseUrl}/save-data`, newMessage);
        let newConversationId;

        if (!currentConversationId.current) {
          socket.disconnect();
          newConversationId = result.data.messageDoc.conversation;
          socket.io.opts.extraHeaders = { email: props.user?.email, conversationId: newConversationId }
          socket.connect();
          currentConversationId.current = newConversationId;
        }

        socket.emit('chat message', newMessage);
        setMessage({ value: '' });
        setNewMessage({ ...newMessage, conversationID: currentConversationId.current || newConversationId });
      } catch (error) {
        console.error("Error sending message:", error);
      }
    }
  };

  const handleInitHistory = async () => {
    await AxiosWithAuth().put(`${baseUrl}/init-history`, { currentConversationId: currentConversationId.current })
      .then(async response => {
        if ('success' === response.data.message) {
          setChat([]);
        }
      })
      .catch(error => {
        window.alert("Error occured while initializing chat history: " + error.response.data.message);
      })
  };
  const handleLeaveRoom = async () => {
    currentConversationId.current = undefined;
    await socket?.emit('leave room', { conversationId: currentConversationId });
    setChat([]);
    participants.current = null;
  }

  useEffect(() => {

    if (!loadingSocket) {
      const IntializeChat = async () => {
        await socket?.on("get connected users", updateUsersList);
        await socket?.emit("get connected users");
        return () => {
          socket?.off("get connected users", updateUsersList);
        };
      }
      IntializeChat();
    }
  }, []);

  useEffect(() => {
    if (!loadingSocket) {
      socket?.on("chat message", handleIncomingMessage);
      socket?.on("update users", updateUsersList);

      return () => {
        socket?.off("chat message", handleIncomingMessage);
        socket?.off("update users", updateUsersList);
      };
    }
  }, [loadingSocket, props.user?.token]);

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

  return (
    <form action={handleSendMessage}>
      <div className="grid md:grid-cols-4 gap-6 p-1 md:p-4 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
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
          <RecentConversationsPanel getLastMessages={getLastMessages} newMessage={newMessage} participants={participants.current!} />
        </div>
        <div className="md:col-start-2 col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 md:p-6">
            <h1 className="text-3xl font-bold text-center mb-2">
              Welcome, {' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-red-600">
                {AsShortName(props.user?.email as string)}
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

            <div className="space-y-4">
              <MessageInput
                message={message}
                setMessage={setMessage}
                participants={participants}
              />

              <Buttons
                handleInitHistory={handleInitHistory}
                handleLeaveRoom={handleLeaveRoom}
                chat={chat}
                message={message}
                participants={participants}
              />
            </div>
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
    </form>
  );
};

export default AuthGuard(memo(Chat));