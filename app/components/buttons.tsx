import Message from "../types/message";
import { useEffect } from 'react';

interface ButtonsProps {
  handleSendMessage: () => Promise<void>;
  handleInitHistory: () => Promise<void>;
  chat: Message[],
  message: Message
}


const Buttons = ({ handleSendMessage, handleInitHistory, chat, message }: ButtonsProps) => {

  const handleKeyDown = async (e: KeyboardEvent) => {
    if (e.key === 'Enter' && message.value?.trim() !== '') {
      await handleSendMessage();
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleSendMessage]);

  return (
    <div className="m-4">
      <button className="disabled:opacity-50 disabled:cursor-not-allowed
              bg-transparent hover:bg-blue-500 text-blue-700 font-semibold
            hover:text-white py-2 px-1 md:px-4 border border-blue-500 hover:border-transparent rounded m-4"
        onClick={handleSendMessage}
        disabled={message.value?.trim() === ''}
        autoFocus={true}
      >Send Message</button>
      <button className="disabled:opacity-50 disabled:cursor-not-allowed
              bg-transparent hover:bg-blue-500 text-blue-700 font-semibold
            hover:text-white py-2 px-1 md:px-4 border border-blue-500 hover:border-transparent rounded m-4"
        onClick={handleInitHistory}
        disabled={chat.length === 0}
      >Initialize History</button>
    </div>
  );
}
export default Buttons;