import { Dispatch, MutableRefObject, SetStateAction } from "react";
import Message from "../types/message";
import ChatUser from "../types/chatUser";

interface MessageInputProps {
    message: Message;
    setMessage: Dispatch<SetStateAction<Message>>;
    participant: MutableRefObject<ChatUser | null | undefined>;
}

const MessageInput = ({ message, setMessage, participant }: MessageInputProps) => {
    return (
        <div className="p-2">
            <input
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg
                     focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700
                     dark:border-gray-600 dark:placeholder-gray-400 dark:text-white
                     dark:focus:ring-blue-500 dark:focus:border-blue-500 mt-4"
                placeholder= {participant.current ? "Type your message here..." : "Select a participant to start chatting"}
                type="text"
                value={message.value}
                onChange={(e) => setMessage({ value: e.target.value })}
                disabled={!participant.current}
            />
        </div>
    );
}
export default MessageInput;