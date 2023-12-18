import Message from "../types/message";
import { useEffect } from 'react';

interface ButtonsProps {
  handleSendMessage: () => Promise<void>;
  handleInitHistory: () => Promise<void>;
  handleLogOut: () => Promise<void>,
  chat: Message[],
  message: Message
}


const Buttons = ({ handleSendMessage, handleInitHistory, handleLogOut, chat, message }: ButtonsProps) => {

  const handleKeyDown = async (e: KeyboardEvent) => {
    if (e.key === 'Enter' && message.value?.trim() !== '') {
      await handleSendMessage();
    }
  };

  useEffect(() => {
    // Attach the event listener to the document
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup the event listener on component unmount
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleSendMessage]);

  return (
    <div className="m-4">
      <button type="submit" className="disabled:opacity-50 disabled:cursor-not-allowed
              bg-transparent hover:bg-blue-500 text-blue-700 font-semibold
            hover:text-white py-2 px-4 border border-blue-500 hover:border-transparent rounded m-4"
        onClick={handleSendMessage}
        disabled={message.value?.trim() === ''}
        autoFocus={true}
      >Send Message</button>
      <button className="disabled:opacity-50 disabled:cursor-not-allowed
              bg-transparent hover:bg-blue-500 text-blue-700 font-semibold
            hover:text-white py-2 px-4 border border-blue-500 hover:border-transparent rounded m-4"
        onClick={handleInitHistory}
        disabled={chat.length === 0}
      >Initialize History</button>
      <button className="disabled:opacity-50 disabled:cursor-not-allowed
              bg-transparent hover:bg-blue-500 text-blue-700 font-semibold
            hover:text-white py-2 px-4 border border-blue-500 hover:border-transparent rounded m-4"
        onClick={handleLogOut}
      >Log Out</button>
    </div>
  );
}
export default Buttons;