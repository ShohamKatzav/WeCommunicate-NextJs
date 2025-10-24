import { RefObject } from "react";
import Message from "../types/message";
import ChatUser from "../types/chatUser";

interface ButtonsProps {
  handleInitHistory: () => Promise<void>;
  handleLeaveRoom: () => void;
  chat: Message[],
  message: Message,
  participants: RefObject<ChatUser[] | null | undefined>
}


const Buttons = ({ handleInitHistory, handleLeaveRoom, chat, message, participants }: ButtonsProps) => {

  return (
    <div className="m-4">
      <input className="disabled:opacity-50 disabled:cursor-not-allowed
              bg-transparent hover:bg-blue-500 text-blue-700 font-semibold
            hover:text-white py-2 px-1 md:px-4 border border-blue-500 hover:border-transparent rounded m-4"
        disabled={message.value?.trim() === '' || !participants.current}
        autoFocus={true}
        type="submit" value="Send Message" />
      <input type="button" value={"Init Room History"} className="disabled:opacity-50 disabled:cursor-not-allowed
              bg-transparent hover:bg-blue-500 text-blue-700 font-semibold
            hover:text-white py-2 px-1 md:px-4 border border-blue-500 hover:border-transparent rounded m-4"
        onClick={handleInitHistory}
        disabled={chat.length === 0}
      />
      <input type="button" value={"Leave Room"} className="disabled:opacity-50 disabled:cursor-not-allowed
              bg-transparent hover:bg-blue-500 text-blue-700 font-semibold
            hover:text-white py-2 px-1 md:px-4 border border-blue-500 hover:border-transparent rounded m-4"
        onClick={handleLeaveRoom}
        disabled={!participants.current}
      />
    </div>
  );
}
export default Buttons;