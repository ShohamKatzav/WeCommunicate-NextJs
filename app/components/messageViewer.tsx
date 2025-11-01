"use client"
import Message from "@/types/message";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { deleteMessage } from '@/app/lib/chatActions'
import { useUser } from "../hooks/useUser";
import { useSocket } from "../hooks/useSocket";
import useIsMobile from '../hooks/useIsMobile';
import { TiDeleteOutline } from "react-icons/ti";
import { IoBan } from "react-icons/io5";

interface MessageViewerProps {
  message: Message;
}

const MessageViewer = ({ message }: MessageViewerProps) => {

  const { user } = useUser();
  const { socket, loadingSocket } = useSocket();

  const sender = message.sender === user?.email ? "You" : message.sender;
  const dateToDisplay = new Date(message.date!).toLocaleString();
  const messageRef = useRef<HTMLDivElement | null>(null);
  const deleteButtonRef = useRef<HTMLButtonElement | null>(null);
  const [hover, setHover] = useState(false); // Show delete button only for desktop
  const [showActions, setShowActions] = useState(false); // Show delete button only for mobile
  const isMobile = useIsMobile();

  const [deleted, setDeleted] = useState(
    message.status?.includes("revoked") ?? false
  );

  const messageStyle = `self-start max-w-[80%] md:max-w-[60%] px-4 py-3 overflow-hidden ${message.sender === user?.email
    ? "bg-blue-400 rounded-br-3xl justify-self-start"
    : "bg-slate-400 rounded-bl-3xl col-start-2 md:col-start-3 justify-self-end"
    } rounded-tl-3xl rounded-tr-xl text-white wrap-break-word overflow-auto gap-6 mb-6`;

  useEffect(() => {
    setDeleted(message.status?.includes("revoked") ?? false);
  }, [message.status]);

  useEffect(() => {
    if (!socket || loadingSocket) return;

    const messageDeletedHandler = async (deletedMessage: Message) => {
      if (deletedMessage._id === message._id)
        setDeleted(true);
    };
    socket.on("delete message", messageDeletedHandler);

    return () => {
      socket.off("delete message", messageDeletedHandler);
    };
  }, [socket?.connected, loadingSocket, message._id]);

  const deleteMessageHandler = async () => {
    await deleteMessage(message._id!);
    setDeleted(true);
    socket?.emit("delete message", message)
  }

  if (deleted) {
    const deletedMessageText = message.sender === user?.email ? 'You deleted this message' :
      'This message was deleted';
    return (
      <div
        className={messageStyle + " flex text-lg md:text-2xl"}
      >
        <IoBan size={30} />
        {deletedMessageText}
      </div >
    )
  }

  return (
    <div className={message.sender === user?.email ? "flex" : ''}>
      <div onClick={() => {
        if (isMobile) setShowActions(prev => !prev);
      }}
        onMouseEnter={() => !isMobile && setHover(true)}
        onMouseLeave={() => !isMobile && setHover(false)}
        className={messageStyle}
        ref={messageRef}
      >
        <div className="text-sm md:text-lg text-gray-200 mb-1">{sender}</div>

        {message.text && (
          <div className="text-lg md:text-2xl wrap-break-word">{message.text}</div>
        )}

        {message.file?.contentType.includes("image")
          && message.file && (
            <Image
              src={message.file.url}
              width={isMobile ? 100 : 250}
              height={isMobile ? 100 : 250}
              alt="Sent image"
            />
          )}

        {message.file?.contentType.includes("audio")
          && message.file && (
            <audio controls>
              <source src={message.file.url} type="audio/mpeg" />
              Your browser does not support the audio element.
            </audio>
          )}

        {message.file?.contentType.includes("video")
          && message.file && (
            <video width="320" height="240" controls preload="none">
              <source src={message.file.url} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          )}

        {(!message.file?.contentType.includes("image")) &&
          (!message.file?.contentType.includes("audio")) &&
          (!message.file?.contentType.includes("video")) &&
          message.file?.downloadUrl && (
            <div className="text-lg md:text-2xl">
              <div>Has sent a document</div>
              <Link href={message.file.url} target="_blank" className="underline">
                View Document
              </Link>{" "}
              &nbsp;
              <Link
                href={message.file.downloadUrl}
                target="_blank"
                className="underline"
              >
                Download Link
              </Link>
            </div>
          )}

        <div className="text-xs md:text-sm text-gray-200 mt-1 text-right">
          {dateToDisplay}
        </div>
      </div>
      <button onClick={deleteMessageHandler}
        ref={deleteButtonRef}
        className='flex'>
        <TiDeleteOutline
          onMouseEnter={() => !isMobile && setHover(true)}
          onMouseLeave={() => !isMobile && setHover(false)}
          className={
            message.sender === user?.email ?
              showActions || hover ? 'block' : 'hidden' : 'hidden'}
          size={40}
          color="red"
        />
      </button>
    </div >
  );
};

export default MessageViewer;