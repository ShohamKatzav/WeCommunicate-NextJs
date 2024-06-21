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

const Chat = (props: any) => {
  const [message, setMessage] = useState<Message>({ date: undefined, sender: '', value: '' });
  const [chat, setChat] = useState<Message[]>([]);
  const chatBox = useRef<HTMLDivElement>(null);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_ADDRESS + "api/chat";
  const [chatListActiveUsers, setChatListActiveUsers] = useState<ChatUser[]>([]);
  const { socket, loadingSocket } = useSocket();

  const getLastMessages = async () => {
    const response = await fetchMessages(1, props.user?.email!);
    const chatWithFormattedDates = response?.chat?.length ? response.chat?.map((message: Message) =>
      ({ ...message, date: new Date(message.date!).toLocaleString() })) : [];
    setChat(chatWithFormattedDates);
  }

  const onChatMessage = (data: Message) => {
    setChat((prevChat) => [...prevChat, { date: new Date(), sender: data.sender, value: data.value }])
  };

  const updateUsersList = (data: ChatUser[]) => {
    setChatListActiveUsers(data);
  };

  const handleSendMessage = async () => {
    if (socket) {
      const newMessage: Message = {
        date: new Date(),
        sender: props.user?.email,
        value: message.value?.trim(),
      };
      await AxiosWithAuth().post(`${baseUrl}/save-data`, newMessage);
      await socket.emit('chat message', newMessage);
      setMessage(({ value: '' }));
    }
  };

  const handleInitHistory = async () => {
    await AxiosWithAuth().put(`${baseUrl}/init-history`, { email: props.user?.email })
      .then(async response => {
        if ('success' === response.data.message) {
          setChat([]);
        }
      })
      .catch(error => {
        window.alert("Error occured while initializing chat history: " + error.response.data.message);
      })
  };

  useEffect(() => {

    if (!loadingSocket) {
      const IntializeChat = async () => {
        await getLastMessages();
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
      socket?.on("connect", getLastMessages);
      socket?.on("chat message", onChatMessage);
      socket?.on("update users", updateUsersList);

      return () => {
        socket?.off("connect", getLastMessages);
        socket?.off("chat message", onChatMessage);
        socket?.off("update users", updateUsersList);
      };
    }
  }, [loadingSocket, props.user?.token]);

  useEffect(() => {
    if (chatBox.current)
      chatBox.current.scrollTop = chatBox.current.scrollHeight;
  }, [chat]);

  return (
    <>
      <div className="grid md:grid-cols-3">
        <div className="md:col-start-2 col-span-1 gap-4 md:w-auto w-screen">
          <h1 className="mb-4 text-3xl font-extrabold text-gray-900 dark:text-white md:text-4xl lg:text-5xl text-center break-words">
            <span className="text-transparent bg-clip-text bg-gradient-to-r to-red-600 from-amber-400">
              Hello {props.user?.email?.split('@')[0]}</span></h1>
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

export default AuthGuard(memo(Chat));