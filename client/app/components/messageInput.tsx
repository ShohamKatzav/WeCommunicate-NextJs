import { Dispatch, SetStateAction } from "react";
import Message from "../types/message";

interface MessageInputProps {
    message: Message;
    setMessage: Dispatch<SetStateAction<Message>>;
}

const MessageInput = ({ message, setMessage }: MessageInputProps) => {
    return (
        <input
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg
                     focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700
                     dark:border-gray-600 dark:placeholder-gray-400 dark:text-white
                     dark:focus:ring-blue-500 dark:focus:border-blue-500 mt-20"
            placeholder="Type your message here..."
            type="text"
            value={message.value}
            onChange={(e) => setMessage((prevState) => ({ id: prevState.id, sender: prevState.sender, value: e.target.value }))}
        />
    );
}
export default MessageInput;