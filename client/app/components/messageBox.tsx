import Message from "../types/message";

interface MessageBoxProps {
  message: Message;
  email: string | undefined; 
}

const MessageBox = ({ message, email }: MessageBoxProps ) => {
  const sender = message.sender == email ? 'You' : message.sender;
  return (
    <div
      className={`mr-2 py-3 px-4 col-span-3 ${message.sender == email ? "bg-blue-400 col-start-1 rounded-br-3xl" :
        "bg-slate-400 col-start-3 rounded-bl-3xl"}
                        rounded-tl-3xl rounded-tr-xl text-white break-words overflow-auto gap-6 mb-6`}>
      <div>On {message.date?.toLocaleString()}</div>
      <div>{sender}</div>
      <div>Said: {message.value}</div>
    </div>
  );
}
export default MessageBox;