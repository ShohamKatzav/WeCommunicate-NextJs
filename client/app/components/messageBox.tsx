import Message from "../types/message";

interface MessageBoxProps {
  message: Message;
  socketId: string | undefined; 
}

const MessageBox = ({ message, socketId }: MessageBoxProps ) => {
  return (
    <div
      className={`mr-2 py-3 px-4 col-span-3 ${message.id === socketId ? "bg-blue-400 col-start-1 rounded-br-3xl" :
        "bg-slate-400 col-start-3 rounded-bl-3xl"}
                        rounded-tl-3xl rounded-tr-xl text-white break-words overflow-auto gap-6 mb-6`}>
      {message.value?.split("\n").map((line: string, index: number) =>
        <div key={index}>
          {line}
        </div>
      )}
    </div>
  );
}
export default MessageBox;