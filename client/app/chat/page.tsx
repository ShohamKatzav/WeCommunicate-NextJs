'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import io, { Socket } from 'socket.io-client';
import { del } from '../utils/cookie-actions';
import fetchUserData, {isLoading} from '../utils/fetchUserData';
import Message from '../types/message';
import User from '../types/user';
import Loading from '../components/loading';
import MessageBox from '../components/messageBox';
import MessageInput from '../components/messageInput';

const Chat = () => {
  const router = useRouter();
  const [message, setMessage] = useState<Message>({ id: '', sender: '', value: '' });
  const [socket, setSocket] = useState<Socket | null>(null);
  const [chat, setChat] = useState<Message[]>([]);
  const chatBox = useRef<HTMLDivElement>(null);
  const baseAddress = process.env.NEXT_PUBLIC_BASE_ADDRESS as string;
  const [user, setUser] = useState<User>({});

  useEffect(() => {
    const connetIfVerified = async () => {
      const user = await fetchUserData() as User;
      setUser(user);
      if (!user?.token)
        router.push("/");
      else {
        var newSocket = io(baseAddress, {
          auth: {
            token: user?.token
          }
        });
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
  }, []);

  useEffect(() => {
    socket?.on("connect", () => {
      setMessage((prevState) => ({ id: socket.id, sender: user.email, value: prevState.value }));
    });
    socket?.on("chat message", (data: Message) => {
      const senderAsName = data.sender ? data.sender.charAt(0).toUpperCase() + data.sender.slice(1).toLowerCase() : '';
      data.id == socket.id ?
        setChat((prevChat) => [...prevChat, { id: data.id, value: `On ${new Date().toLocaleString()}\nYou\nSaid: ` + data.value }]) :
        setChat((prevChat) => [...prevChat, { id: data.id, value: `On ${new Date().toLocaleString()}\n${senderAsName}\nSaid: ` + data.value }])
    });
  }, [socket]);

  useEffect(() => {
    if (chatBox.current)
      chatBox.current.scrollTop = chatBox.current.scrollHeight;
  }, [chat]);

  const handleSendMessage = async () => {
    if (socket) {
      await socket.emit('chat message', message);
      setMessage((prevState) => ({ id: prevState.id, sender: prevState.sender, value: '' }));
    }
  };

  const handleLogOut = async () => {
    await del();
    router.push("/");
  };

  if (isLoading()) return <Loading/>

  else
    return (
      <div className='grid grid-cols-3 mt-10'>
        <div className="col-start-2 col-span-1 gap-4">
        <h1 className="row-start-6 mb-4 text-3xl font-extrabold text-gray-900 dark:text-white md:text-4xl lg:text-5xl text-center">
          <span className="text-transparent bg-clip-text bg-gradient-to-r to-red-600 from-amber-400">
            Hello {user.email ? user.email.charAt(0).toUpperCase() + user.email.slice(1).toLowerCase() : ''}</span></h1>
          <MessageInput message={message} setMessage={setMessage}/>
          <div className="m-4">
            <button className="disabled:opacity-50 disabled:cursor-not-allowed
              bg-transparent hover:bg-blue-500 text-blue-700 font-semibold
            hover:text-white py-2 px-4 border border-blue-500 hover:border-transparent rounded m-4"
              onClick={handleSendMessage}
              disabled={message.value?.trim() === ''}
            >Send Message</button>
            <button className="disabled:opacity-50 disabled:cursor-not-allowed
              bg-transparent hover:bg-blue-500 text-blue-700 font-semibold
            hover:text-white py-2 px-4 border border-blue-500 hover:border-transparent rounded m-4"
              onClick={handleLogOut}
            >Log Out</button>
          </div>
          <div className="mt-5">
            <div ref={chatBox} className="w-full flex flex-col md:flex-cols-4 overflow-y-auto h-80">
              <div className="grid md:grid-cols-5">
                {chat.map((message, index) =>
                  <MessageBox key={index} message={message} socketId={socket?.id} />)
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    );
};

export default Chat;