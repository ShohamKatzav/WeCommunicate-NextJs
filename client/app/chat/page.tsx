'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import io, { Socket } from 'socket.io-client';
import AxiosWithAuth from '../utils/axiosWithAuth';
import Message from '../types/message';
import ChatUser from '../types/chatUser';
import Loading from '../components/loading';
import MessageInput from '../components/messageInput';
import Buttons from '../components/buttons';
import UsersList from '../components/usersList';
import { useUser } from '../hooks/useUser';
import fetchMessages from '../actions/message-actions';
import MessagesBox from '../components/messagesBox';

const Chat = () => {
  const router = useRouter();
  const [message, setMessage] = useState<Message>({ date: undefined, sender: '', value: '' });
  const [socket, setSocket] = useState<Socket | null>(null);
  const [chat, setChat] = useState<Message[]>([]);
  const chatBox = useRef<HTMLDivElement>(null);
  const baseAddress = process.env.NEXT_PUBLIC_BASE_ADDRESS as string;
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH as string;
  const [chatListActiveUsers, setChatListActiveUsers] = useState<ChatUser[]>([]);
  const { user, loading } = useUser();

  useEffect(() => {
    const connetIfVerified = async () => {
      const socketConfig = {
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 10000,
        reconnectionDelayMax: 10000,
        auth: {
          token: user?.token
        }
      }
      const newSocket = io(baseAddress, socketConfig);
      if (!user || !user.token) router.replace("/");
      else {
        newSocket.connect();
        setSocket(newSocket);
      }
      return () => {
        newSocket?.disconnect();
      };
    }
    const cleanup = connetIfVerified();
    return () => {
      cleanup.then(cleanupFunction => cleanupFunction()); // Execute the cleanup function
    };
  }, [loading]);

  useEffect(() => {

    const onConnection = async () => {
      const response = await fetchMessages(1, user?.email!);
      const chatWithFormattedDates = response?.chat!.length ? response.chat?.map((message: Message) =>
        ({ ...message, date: new Date(message.date!).toLocaleString() })) : [];
      setChat(chatWithFormattedDates);
    }

    const onChatMessage = (data: Message) => {
      setChat((prevChat) => [...prevChat, { date: new Date(), sender: data.sender, value: data.value }])
    };

    const updateUsersList = async (data: ChatUser[]) => {
      setChatListActiveUsers(data);
    };

    socket?.on("connect", onConnection);
    socket?.on("chat message", onChatMessage);
    socket?.on("update users", updateUsersList);

    return () => {
      socket?.off("connect", onConnection);
      socket?.off("chat message", onChatMessage);
      socket?.off("update users", updateUsersList);
    };
  }, [socket]);

  useEffect(() => {
    if (chatBox.current)
      chatBox.current.scrollTop = chatBox.current.scrollHeight;
  }, [chat]);

  const handleSendMessage = async () => {
    if (socket) {
      const newMessage: Message = {
        date: new Date(),
        sender: user?.email,
        value: message.value?.trim(),
      };
      await AxiosWithAuth().post(`${basePath}/save-data`, newMessage);
      await socket.emit('chat message', newMessage);
      setMessage(({ value: '' }));
    }
  };

  const handleInitHistory = async () => {
    await AxiosWithAuth().put(`${basePath}/init-history`, { email: user?.email })
      .then(async response => {
        if ('success' === response.data.message) {
          setChat([]);
        }
      })
      .catch(error => {
        window.alert("Error occured while initializing chat: " + error.response.data.message);
      })
  };

  if (loading || user !== null && Object.keys(user).length === 0) return <Loading />

  else
    return (
      <>
        <div className="grid md:grid-cols-3">
          <div className="md:col-start-2 col-span-1 gap-4">
            <h1 className="mb-4 text-3xl font-extrabold text-gray-900 dark:text-white md:text-4xl lg:text-5xl text-center">
              <span className="text-transparent bg-clip-text bg-gradient-to-r to-red-600 from-amber-400">
                Hello {user?.email}</span></h1>
            <MessagesBox messages={chat} chatBox={chatBox} />
            <MessageInput message={message} setMessage={setMessage} />
            <Buttons
              handleSendMessage={handleSendMessage}
              handleInitHistory={handleInitHistory}
              chat={chat}
              message={message}
            />
          </div>
        </div>
        <div className="grid md:grid-cols-3 mt-10">
          <div className="md:col-start-3 col-span-1 gap-4">
            <div className="md:grid md:justify-start md:content-end md:mx-4">
              <UsersList chatListActiveUsers={chatListActiveUsers} />
            </div>
          </div>
        </div>
      </>
    );
};

export default Chat;