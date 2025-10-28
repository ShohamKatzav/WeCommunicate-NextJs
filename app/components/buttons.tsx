import { RefObject, useEffect } from "react";
import Message from "../types/message";
import ChatUser from "../types/chatUser";

interface ButtonsProps {
  handleCleanHistory: () => Promise<void>;
  handleLeaveRoom: () => void;
  chat: Message[];
  message: Message;
  participants: RefObject<ChatUser[] | null | undefined>;
}

const Buttons = ({ handleCleanHistory, handleLeaveRoom, chat, message, participants }: ButtonsProps) => {
  const baseStyle = `
    disabled:opacity-50 disabled:cursor-not-allowed
    bg-transparent hover:bg-blue-500 text-blue-700 font-semibold
    hover:text-white py-2 px-3 border border-blue-500 hover:border-transparent rounded
    transition-all duration-200 text-sm sm:text-base
  `;

  return (
    <div className="flex flex-wrap justify-center gap-2 sm:gap-4 m-4">
      <input
        type="submit"
        value="Send Message"
        className={baseStyle}
        disabled={(message.text?.trim() === "" && !(message.file)) || !participants.current}
        autoFocus
      />
      <input
        type="button"
        value="Clean Room History"
        className={baseStyle}
        onClick={handleCleanHistory}
        disabled={chat.length === 0}
      />
      <input
        type="button"
        value="Leave Room"
        className={baseStyle}
        onClick={handleLeaveRoom}
        disabled={!participants.current}
      />
    </div>
  );
};

export default Buttons;