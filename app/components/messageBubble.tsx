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
import { Check, CheckCheck, Reply } from "lucide-react";
import { toast } from "sonner";
import FullscreenMediaViewer from './fullscreenMediaViewer';
import AudioPlayer from './audioPlayer';
import { AsShortName } from "../utils/stringFormat";
import { linkifyText } from "../utils/linkify";
import { DEFAULT_ACCENT_COLOR } from "../config/limits";

interface MessageBubbleProps {
  message: Message;
  onReply?: (message: Message) => void;
}

const MessageBubble = ({ message, onReply }: MessageBubbleProps) => {

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

  const isOwnMessage = message.sender === user?.email;
  const sender = isOwnMessage ? "You" : AsShortName(message.sender);
  const dateToDisplay = new Date(message.date!).toLocaleString();
  // green-500/gray-500 (the previous values) were too light for the white
  // text on top of them - as low as 1.79:1 for the sender label, well under
  // the 4.5:1 text needs. -600/-700 are dark enough that plain white text
  // clears 4.5:1 everywhere in the bubble (sender label, body, timestamp),
  // so nothing inside it needs its own lighter/translucent shade to "look"
  // secondary - font-size and weight do that job instead. Bubble colours
  // stay fixed across both site themes (like the navbar/footer) rather than
  // following light/dark, the same way most chat apps don't reflow message
  // colours when you flip the app's theme.
  const messageStyle = `max-w-[80%] md:max-w-[60%] px-3.5 py-2 md:px-4 md:py-3 overflow-hidden
  ${isOwnMessage ? "rounded-br-3xl" : "bg-gray-600 rounded-bl-3xl"
    } rounded-tl-3xl rounded-tr-xl text-white wrap-break-word mb-3 md:mb-6
    ${deleted ? "gap-1 flex text-lg md:text-2xl" : "gap-6"}`;
  // Own bubbles use the sender's chosen accent color (types/user.ts,
  // profileActions.ts) instead of a hardcoded class, falling back to the
  // exact green-700 hex this used to be a Tailwind class for, so a user who
  // never picked an accent sees today's bubble unchanged.
  const bubbleAccentStyle = isOwnMessage ? { backgroundColor: user?.accentColor || DEFAULT_ACCENT_COLOR } : undefined;
  // Own messages sit on the left and received ones on the right - which is also
  // the side each bubble's squared-off corner points at. The side has to be set
  // on this row, because the bubble itself only ever carried justify-self and
  // col-start, and neither does anything unless the parent is a grid: every
  // bubble was landing on the left regardless of sender.
  const messageRowStyle = `flex items-center ${isOwnMessage ? "justify-start" : "justify-end"}`;


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

  // Desktop hover hitbox for reply/delete: tracked on the row (bubble +
  // buttons together, see below) rather than the bubble alone, so crossing
  // from the bubble onto a button doesn't cross a gap that clears hover
  // first. But the row is a full-width block (it has to be, to justify-
  // start/end the bubble+buttons to the correct side - see messageRowStyle),
  // so it reaches far past the buttons into empty space. Gate on cursor X
  // too: own messages (buttons trail the bubble on the right) stop tracking
  // past the delete button's right edge; received messages (button trails
  // the bubble on the right, but the row itself is right-aligned so the
  // empty space is on the left) start tracking at the bubble's own left
  // edge.
  const handleRowMouseMove = (e: React.MouseEvent) => {
    if (isMobile) return;
    if (isOwnMessage) {
      const rightEdge = deleteButtonRef.current?.getBoundingClientRect().right;
      setHover(rightEdge == null || e.clientX <= rightEdge);
    } else {
      const leftEdge = messageRef.current?.getBoundingClientRect().left;
      setHover(leftEdge == null || e.clientX >= leftEdge);
    }
  };

  const handleRowMouseLeave = () => {
    if (!isMobile) setHover(false);
  };

  if (deleted) {
    const deletedMessageText = isOwnMessage ? 'You deleted this message' :
      'This message was deleted';
    return (
      <div className={messageRowStyle}>
        <div
          className={messageStyle}
          style={bubbleAccentStyle}
          data-testid={isOwnMessage ? "sent-message" : "received-message"}
        >
          <IoBan size={isMobile ? 25 : 30} />
          {deletedMessageText}
        </div >
      </div>
    )
  }

  const isPending = !message._id?.match(/^[a-f0-9]{24}$/);
  const isRead = message.status === 'read';

  return (
    <div
      className={messageRowStyle}
      onMouseMove={handleRowMouseMove}
      onMouseLeave={handleRowMouseLeave}
    >
      <div onClick={() => {
        if (isMobile) setShowActions(prev => !prev);
      }}
        className={messageStyle}
        style={bubbleAccentStyle}
        data-testid={message.sender === user?.email ? "sent-message" : "received-message"}
        ref={messageRef}
      >
        <div className="text-sm md:text-lg text-white mb-1">{sender}</div>

        {message.replyTo && (
          <div className="border-l-2 border-white/80 bg-black/15 rounded-r-md pl-2 pr-2 py-1 mb-1.5 text-sm md:text-base text-white/95 wrap-break-word">
            <div className="font-medium">
              {message.replyTo.sender === user?.email ? "You" : AsShortName(message.replyTo.sender)}
            </div>
            <div className="line-clamp-2 opacity-90">{message.replyTo.snippet || "Attachment"}</div>
          </div>
        )}

        {message.text && (
          <div className="text-lg md:text-2xl wrap-break-word">{linkifyText(message.text)}</div>
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

          {(message.file?.contentType.includes("audio") || message.file?.pathname?.includes("voice-message"))
            && message.file && (
              <AudioPlayer
                src={message.file.url}
                type={message.file.contentType?.startsWith("video/webm") ? "audio/webm" : message.file.contentType}
              />
            )}

          {message.file?.contentType.includes("video")
            && !message.file?.pathname?.includes("voice-message")
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
            !message.file?.pathname?.includes("voice-message") &&
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
        <div className="text-xs md:text-sm mt-1 text-right flex items-center justify-end gap-1 text-white">
          {dateToDisplay}
          {
            isPending && <TbClockQuestion color="red" size={38} className="inline p-2" />
          }
          {isOwnMessage && !isPending && (
            isRead
              ? <CheckCheck size={18} strokeWidth={2.75} className="shrink-0 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.55)]" aria-label="Read" />
              : <Check size={18} strokeWidth={2.5} className="shrink-0 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]" aria-label="Sent" />
          )}
        </div>
      </div>
      {onReply && !isPending && (
        <button onClick={() => onReply(message)}
          className='flex'
          aria-label="Reply to message">
          <Reply
            className={showActions || hover ? 'block' : 'hidden'}
            size={28}
          />
        </button>
      )}

      {isOwnMessage && (
        <button onClick={deleteMessageHandler}
          ref={deleteButtonRef}
          className='flex'
          aria-label="Delete message">
          <TiDeleteOutline
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