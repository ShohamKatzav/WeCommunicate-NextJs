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
import { Check, CheckCheck } from "lucide-react";
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
      const result = await deleteMessage(message._id!, "message");
      if (!result.success) {
        // A definite rejection from the server (e.g. not the actual sender,
        // or the message no longer exists) - don't pretend it was deleted
        // locally or broadcast a delete for it to everyone else.
        toast.error(result.message || "Couldn't delete that message.");
        return;
      }
      socket?.emit("delete message", message);
      setDeleted(true);
    }
    catch {
      // A genuine network failure - the service worker queues this for
      // retry, so optimistically show it as deleted.
      toast.info("Could not complete the operation now. The message will be deleted when the connection is restored.");
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
        data-testid={message.sender === user?.email ? "sent-message" : "received-message"}
      >
        <IoBan size={isMobile ? 25 : 30} />
        {deletedMessageText}
      </div >
    )
  }

  const isPending = !message._id?.match(/^[a-f0-9]{24}$/);
  const isOwnMessage = message.sender === user?.email;
  const isRead = message.status === 'read';

  return (
    <div className={message.sender === user?.email ? "flex" : ''}>
      <div onClick={() => {
        if (isMobile) setShowActions(prev => !prev);
      }}
        onMouseEnter={() => !isMobile && setHover(true)}
        onMouseLeave={() => !isMobile && setHover(false)}
        className={messageStyle}
        data-testid={message.sender === user?.email ? "sent-message" : "received-message"}
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
                <source src={message.file.url} type={message.file.contentType} />
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
                <source src={message.file.url} type={message.file.contentType} />
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
        <div className="text-xs md:text-sm text-gray-200 mt-1 text-right flex items-center justify-end gap-1">
          {dateToDisplay}
          {
            isPending && <TbClockQuestion color="red" size={38} className="inline p-2" />
          }
          {isOwnMessage && !isPending && (
            isRead
              ? <CheckCheck size={16} className="text-blue-300" aria-label="Read" />
              : <Check size={16} aria-label="Sent" />
          )}
        </div>
      </div>
      {message.sender === user?.email && (
        <button onClick={deleteMessageHandler}
          ref={deleteButtonRef}
          className='flex'
          aria-label="Delete message">
          <TiDeleteOutline
            onMouseEnter={() => !isMobile && setHover(true)}
            onMouseLeave={() => !isMobile && setHover(false)}
            className={showActions || hover ? 'block' : 'hidden'}
            size={40}
            color="red"
          />
        </button>
      )}

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