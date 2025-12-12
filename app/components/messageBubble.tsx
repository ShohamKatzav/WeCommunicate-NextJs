"use client"
import Message from "@/types/message";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { deleteMessage } from '@/app/lib/chatActions'
import { useUser } from "@/app/hooks/useUser";
import { useSocket } from "@/app/hooks/useSocket";
import useIsMobile from '@/app/hooks/useIsMobile';
import { TiDeleteOutline } from "react-icons/ti";
import { IoBan } from "react-icons/io5";
import { TbClockQuestion } from "react-icons/tb";
import { toast } from "sonner";
import FullscreenMediaViewer from './fullscreenMediaViewer';
import { AsShortName } from "../utils/stringFormat";

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble = ({ message }: MessageBubbleProps) => {

  const { user } = useUser();
  const { socket } = useSocket();
  const isMobile = useIsMobile();

  const messageRef = useRef<HTMLDivElement | null>(null);
  const deleteButtonRef = useRef<HTMLButtonElement | null>(null);
  const [hover, setHover] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [deleted, setDeleted] = useState(
    message.status?.includes("revoked") ?? false
  );

  const sender = message.sender === user?.email ? "You" : AsShortName(message.sender);
  const dateToDisplay = new Date(message.date!).toLocaleString();
  const messageStyle = `self-start max-w-[80%] md:max-w-[60%] px-3.5 py-2 md:px-4 md:py-3 overflow-hidden 
  ${message.sender === user?.email ? "bg-green-500 rounded-br-3xl justify-self-start"
      : "bg-gray-500 rounded-bl-3xl col-start-2 md:col-start-3 justify-self-end"
    } rounded-tl-3xl rounded-tr-xl text-white wrap-break-word mb-3 md:mb-6
    ${deleted ? "gap-1 flex text-lg md:text-2xl" : "gap-6"}`;


  useEffect(() => {
    setDeleted(message.status?.includes("revoked") ?? false);
  }, [message.status]);

  const deleteMessageHandler = async () => {
    try {
      await deleteMessage(message._id!, "message");
      socket?.emit("delete message", message);
    }
    catch {
      toast.info("Could not complete the operation now. The message will be deleted when the connection is restored.");
    }
    finally {
      setDeleted(true);
    }
  }

  const handleMediaDoubleClick = () => {
    setIsFullscreen(true);
  };

  if (deleted) {
    const deletedMessageText = message.sender === user?.email ? 'You deleted this message' :
      'This message was deleted';
    return (
      <div
        className={messageStyle}
      >
        <IoBan size={isMobile ? 25 : 30} />
        {deletedMessageText}
      </div >
    )
  }

  const isPending = !message._id?.match(/^[a-f0-9]{24}$/);

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

        {message.file?.contentType && <>
          {message.file?.contentType.includes("image")
            && message.file && (
              <Image
                onDoubleClick={() => {
                  if (isMobile) handleMediaDoubleClick();
                }}
                onClick={() => {
                  if (!isMobile) handleMediaDoubleClick();
                }}
                src={message.file.url}
                width={isMobile ? 90 : 150}
                height={isMobile ? 90 : 150}
                alt="Sent image"
                className="cursor-pointer"
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
              <video
                width="320"
                height="240"
                controls
                preload="none"
                className="cursor-pointer"
              >
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
        </>
        }
        <div className="text-xs md:text-sm text-gray-200 mt-1 text-right">
          {dateToDisplay}
          {
            isPending && <TbClockQuestion color="red" size={38} className="inline p-2" />
          }
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

      {/* Fullscreen Media Viewer */}
      {isFullscreen && message.file && (
        <FullscreenMediaViewer
          src={message.file.url}
          onClose={() => setIsFullscreen(false)}
        />
      )}
    </div >
  );
};

export default MessageBubble;