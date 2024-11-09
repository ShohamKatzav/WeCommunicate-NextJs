'use client';
import { memo, useEffect, useRef, useState } from 'react';
import { MessageCircle } from 'lucide-react';
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
import AsName from '../utils/asName';
import { useNotification } from '../hooks/useNotification';

const Chat = (props: any) => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_ADDRESS + "api/chat";
  const { socket, loadingSocket } = useSocket();
  const [chat, setChat] = useState<Message[]>([]);
  const [message, setMessage] = useState<Message>({ date: undefined, sender: '', value: '' });
  const [chatListActiveUsers, setChatListActiveUsers] = useState<ChatUser[]>([]);
  const currentConversationId = useRef<string>();
  const participant = useRef<ChatUser | null>();
  const chatBox = useRef<HTMLDivElement>(null);

  const { increaseNotifications } = useNotification();

  const getLastMessages = async (participantFromList: ChatUser) => {
    await socket?.emit('leave room', { conversationId: currentConversationId });
    const response = await fetchMessages(1, participantFromList._id!);
    await socket?.emit('join room', { conversationId: response.conversation });
    const chatWithFormattedDates = response?.chat?.length ? response.chat?.map((message: Message) =>
      ({ ...message, date: new Date(message.date!).toLocaleString() })) : [];
    currentConversationId.current = response.conversation;
    setChat(chatWithFormattedDates);
    participant.current = participantFromList;
  }

  const handleIncomingMessage = (data: Message) => {
    if (data.sender?.toUpperCase() === participant.current?.email?.toUpperCase()) {
      setChat((prevChat) => [...prevChat, { date: new Date(), sender: data.sender, value: data.value }]);
    }
    else
      increaseNotifications(data.sender as string);
  }

  const updateUsersList = (data: ChatUser[]) => {
    setChatListActiveUsers(data);
  };

  const handleSendMessage = async () => {
    if (socket && participant.current?._id) {
      const newMessage: Message = {
        date: new Date(),
        sender: props.user?.email,
        participantID: participant.current._id,
        value: message.value?.trim(),
        conversationID: currentConversationId.current
      };

      setChat((prevChat) => [...prevChat, newMessage]);

      try {
        const result = await AxiosWithAuth().post(`${baseUrl}/save-data`, newMessage);

        if (!currentConversationId.current) {
          socket.disconnect();
          const newConversationId = result.data.messageDoc.conversation;
          socket.io.opts.extraHeaders = { email: props.user?.email, conversationId: newConversationId }
          socket.connect();
          currentConversationId.current = newConversationId;
        }

        socket.emit('chat message', newMessage);
        setMessage({ value: '' });
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
    await socket?.emit('leave room', { conversationId: currentConversationId });
    setChat([]);
    participant.current = null;
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



  return (
    <form action={handleSendMessage}>
      <div className="grid md:grid-cols-3 gap-6 p-1 md:p-4 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="md:col-start-2 col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 md:p-6">
            <h1 className="text-3xl font-bold text-center mb-2">
              Welcome, {' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-red-600">
                {props.user?.email?.split('@')[0]}
              </span>
            </h1>

            <div className="flex items-center justify-center space-x-2 text-gray-600 dark:text-gray-300">
              <MessageCircle className="w-5 h-5" />
              <p className="text-lg">
                {participant.current
                  ? `Chatting with ${AsName(participant.current?.email?.split('@')[0] as string)}`
                  : "Please select a participant to chat with"
                }
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
              <MessagesBox
                messages={chat}
                chatBox={chatBox}
                participant={participant.current!}
              />
            </div>

            <div className="space-y-4">
              <MessageInput message={message} setMessage={setMessage} />

              <Buttons
                handleInitHistory={handleInitHistory}
                handleLeaveRoom={handleLeaveRoom}
                chat={chat}
                message={message}
                participant={participant}
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
            />
          </div>
        </div>
      </div>
    </form>
  );
};

export default AuthGuard(memo(Chat));