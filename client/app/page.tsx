'use client';
import { useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';

const Page = () => {
  const [message, setMessage] = useState<{ id: string | undefined, message: string }>({ id: '', message: '' });
  const [socket, setSocket] = useState<Socket | null>(null);
  const [chat, setChat] = useState<string[]>([]);
  const chatBox = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const newSocket = io('http://localhost:5000'); // Backend URL
    setSocket(newSocket);

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    socket?.on("chat message", (data: { id: string, message: string }) => {
      data.id == socket.id ?
        setChat((prevChat) => [...prevChat, `On ${new Date().toLocaleString()}\nYou\nSaid: ` + data.message]) :
        setChat((prevChat) => [...prevChat, `On ${new Date().toLocaleString()}\nSocket Id: ${data.id}\nSaid: ` + data.message])
    });
  }, [socket]);

  useEffect(() => {
    if (socket?.id)
      setMessage((prevState) => ({ id: socket?.id, message: prevState.message }));
  }, [socket?.id]);

  useEffect(() => {
    if (chatBox.current)
      chatBox.current.scrollTop = chatBox.current.scrollHeight;
  }, [chat]);

  const handleSendMessage = async () => {
    if (socket) {
      await socket.emit('chat message', message);
      setMessage((prevState) => ({ id: prevState.id, message: '' }));
    }
  };

  return (
    <>
      <div className='px-5 py-5'>
        <h1 className="text-3xl font-bold underline">Next.js with Express and Socket.IO</h1>
        <div className="grid gap-6 mb-6 md:grid-cols-4">
          <input
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg
           focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700
            dark:border-gray-600 dark:placeholder-gray-400 dark:text-white
             dark:focus:ring-blue-500 dark:focus:border-blue-500 mt-20"
            placeholder="Type your message here..."
            type="text"
            value={message.message}
            onChange={(e) => setMessage((prevState) => ({ id: prevState.id, message: e.target.value }))}
          />
        </div>
        <button className="bg-transparent hover:bg-blue-500 text-blue-700 font-semibold
      hover:text-white py-2 px-4 border border-blue-500 hover:border-transparent rounded"
          onClick={handleSendMessage}>Send Message</button>
        <div className="grid gap-6 mb-6 md:grid-cols-4 mt-5">
          <div ref={chatBox} className="w-full flex flex-col md:flex-cols-4 overflow-y-auto h-80">
            <div className="grid gap-6 mb-6 md:grid-cols-1">
              {chat.map((line, index) =>
                <div
                  className="mr-2 py-3 px-4 bg-blue-400 rounded-bl-3xl rounded-tl-3xl
                                rounded-tr-xl text-white break-words overflow-auto"
                  key={index}>
                  {line.split("\n").map((line, index) =>
                    <div key={index}>
                      {line}
                    </div>
                  )}
                </div>)
              }
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Page;