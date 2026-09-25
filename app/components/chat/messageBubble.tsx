"use client"
import Message from "@/types/message";
import MessageReaction from "@/types/messageReaction";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { deleteMessage, toggleMessageReaction } from '@/app/lib/chatActions'
import { useUser } from "@/app/hooks/useUser";
import { useSocket } from "@/app/hooks/useSocket";
import useIsMobile from '@/app/hooks/useIsMobile';
import { TiDeleteOutline } from "react-icons/ti";
import { IoBan } from "react-icons/io5";
import { TbClockQuestion } from "react-icons/tb";
import { Check, CheckCheck, Reply, SmilePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import FullscreenMediaViewer from './fullscreenMediaViewer';
import AudioPlayer from './audioPlayer';
import LocationBubble from './locationBubble';
import FullscreenLocationViewer from './fullscreenLocationViewer';
import CallRecordRow from './callRecordRow';
import ReactionPicker from './reactionPicker';
import { clearActiveMessage, setActiveMessage, useIsActiveMessage } from './activeMessageStore';
import { AsShortName } from "../../utils/stringFormat";
import { linkifyText } from "../../utils/linkify";
import { DEFAULT_ACCENT_COLOR } from "../../config/limits";

interface MessageBubbleProps {
  message: Message;
  onReply?: (message: Message) => void;
  senderAccentColor?: string;
}

const MessageBubble = ({ message, onReply, senderAccentColor }: MessageBubbleProps) => {

  const { user } = useUser();
  const { socket } = useSocket();
  const isMobile = useIsMobile();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const messageRef = useRef<HTMLDivElement | null>(null);
  const deleteButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState(false);
  // Set once an action has been used from the desktop hover strip, so the
  // strip stays hidden while the cursor is still resting on the row instead
  // of reappearing on the very next mousemove - it comes back after the
  // cursor leaves and returns.
  const hoverSuppressed = useRef(false);
  const reactButtonRef = useRef<HTMLButtonElement | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const [pickerPosition, setPickerPosition] = useState<React.CSSProperties | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [deleted, setDeleted] = useState(
    message.status?.includes("revoked") ?? false
  );
  // Seeded from the message as loaded, then kept current by this bubble's
  // own socket subscription below rather than by its parent - older pages
  // are rendered from MoreMessagesLoader's separate list, which the chat
  // state a parent-owned handler updates never reaches.
  const [reactions, setReactions] = useState<MessageReaction[]>(message.reactions || []);
  // Only one message at a time has its actions open (see
  // activeMessageStore.ts): on mobile that's the action menu under the
  // tapped bubble, on desktop the reaction picker.
  const isActive = useIsActiveMessage(message._id);
  const showMobileMenu = isActive && isMobile;
  const showReactionPicker = isActive && !isMobile;

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
  // Own bubbles use the viewer's chosen accent color (types/user.ts,
  // profileActions.ts) instead of a hardcoded class, falling back to the
  // exact green-700 hex this used to be a Tailwind class for, so a user who
  // never picked an accent sees today's bubble unchanged. That color stays
  // on this screen: a 1:1 leaves senderAccentColor unset, so the other
  // person's bubbles keep bg-gray-600. Group chats pass each sender's accent
  // (see utils/accentColor.ts) and the inline style overrides that class.
  // The class stays either way, both as the 1:1 / unset-accent fallback and
  // because it marks a received bubble in the DOM. Every accent in the
  // palette is dark enough for the white bubble text either way.
  const bubbleAccentStyle = isOwnMessage
    ? { backgroundColor: user?.accentColor || DEFAULT_ACCENT_COLOR }
    : (senderAccentColor ? { backgroundColor: senderAccentColor } : undefined);
  // Own messages sit on the left and received ones on the right - which is also
  // the side each bubble's squared-off corner points at. The side has to be set
  // on this row, because the bubble itself only ever carried justify-self and
  // col-start, and neither does anything unless the parent is a grid: every
  // bubble was landing on the left regardless of sender.
  const messageRowStyle = `flex items-center ${isOwnMessage ? "justify-start" : "justify-end"}`;


  useEffect(() => {
    setDeleted(message.status?.includes("revoked") ?? false);
  }, [message.status]);

  useEffect(() => {
    if (!socket || !message._id) return;

    const handleReactions = (data: { messageId: string; reactions: MessageReaction[] }) => {
      if (data.messageId !== message._id) return;
      setReactions(data.reactions || []);
    };

    socket.on("message reactions", handleReactions);
    return () => {
      socket.off("message reactions", handleReactions);
    };
  }, [socket, message._id]);

  useEffect(() => {
    if (!isActive || !message._id) return;
    const id = message._id;

    // click rather than pointerdown: closing this menu shifts the list
    // (it's bottom-anchored), so closing it on pointerdown moved a tapped
    // bubble out from under the finger before its click landed, and the tap
    // opened nothing. On click, a tapped bubble has already made itself the
    // active one by the time this runs, which makes the clear a no-op.
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // The desktop picker is portaled to <body>, outside this container.
      if (containerRef.current?.contains(target) || pickerRef.current?.contains(target)) return;
      clearActiveMessage(id);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") clearActiveMessage(id);
    };

    document.addEventListener("click", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isActive, message._id]);

  // A bubble that unmounts (deleted, scrolled out of the loaded pages, or
  // in a conversation the user just left) mustn't stay registered as the
  // open one.
  useEffect(() => {
    const id = message._id;
    if (!id) return;
    return () => clearActiveMessage(id);
  }, [message._id]);

  // The menu sits in the flow under the bubble, so for a message near the
  // bottom of the list it can open below the visible area.
  useEffect(() => {
    if (showMobileMenu) mobileMenuRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [showMobileMenu]);

  // The desktop picker is fixed-position (see below), so it has to follow its
  // button when the chat scrolls or the window resizes while it's open.
  useLayoutEffect(() => {
    if (!showReactionPicker) return;
    const place = () => {
      const rect = reactButtonRef.current?.getBoundingClientRect();
      if (!rect) return;
      // Whichever side of the button has more room - the expanded picker is
      // tall enough to run off the screen on the smaller one.
      const upward = rect.top > window.innerHeight - rect.bottom;
      setPickerPosition({
        ...(upward ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
        ...(isOwnMessage ? { left: rect.left } : { right: window.innerWidth - rect.right }),
      });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [showReactionPicker, isOwnMessage]);

  // Any action taken closes the actions it was taken from.
  const closeActions = () => {
    if (message._id) clearActiveMessage(message._id);
    if (!isMobile) {
      hoverSuppressed.current = true;
      setHover(false);
    }
  };

  const myReaction = reactions.find(
    reaction => reaction.sender?.toLowerCase() === user?.email?.toLowerCase()
  );

  // Grouped in first-reaction order so a chip doesn't jump around as counts
  // change.
  const reactionGroups = reactions.reduce<{ emoji: string; senders: string[] }[]>((groups, reaction) => {
    const group = groups.find(candidate => candidate.emoji === reaction.emoji);
    if (group) group.senders.push(reaction.sender);
    else groups.push({ emoji: reaction.emoji, senders: [reaction.sender] });
    return groups;
  }, []);

  const handleReact = async (emoji: string) => {
    if (!message._id || !user?.email) return;

    closeActions();
    const previous = reactions;
    const withoutMine = reactions.filter(reaction => reaction !== myReaction);
    setReactions(myReaction?.emoji === emoji ? withoutMine : [...withoutMine, { emoji, sender: user.email }]);

    try {
      const result = await toggleMessageReaction(message._id, emoji);
      if (!result.success) {
        setReactions(previous);
        toast.error(result.message || "Couldn't save that reaction.");
        return;
      }
      setReactions(result.reactions);
      socket?.emit("react to message", { messageId: message._id });
    } catch {
      // Reactions aren't part of the offline outbox (unlike a message, one
      // isn't worth replaying minutes later against a conversation that has
      // moved on), so an offline tap is undone rather than left showing as
      // if it had been saved.
      setReactions(previous);
      toast.info("Couldn't save that reaction while you're offline.");
    }
  };

  const deleteMessageHandler = async () => {
    closeActions();
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

  // Shared by the media (photo/video) and location bubbles below - same
  // fullscreen behavior either way, just a different viewer rendered at the
  // bottom of this component depending on which the message actually has.
  const openFullscreen = () => {
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
    if (isMobile || hoverSuppressed.current) return;
    if (isOwnMessage) {
      const rightEdge = deleteButtonRef.current?.getBoundingClientRect().right;
      setHover(rightEdge == null || e.clientX <= rightEdge);
    } else {
      const leftEdge = messageRef.current?.getBoundingClientRect().left;
      setHover(leftEdge == null || e.clientX >= leftEdge);
    }
  };

  const handleRowMouseLeave = () => {
    if (isMobile) return;
    hoverSuppressed.current = false;
    setHover(false);
  };

  const isPending = !message._id?.match(/^[a-f0-9]{24}$/);

  const handleReply = () => {
    closeActions();
    onReply?.(message);
  };

  const toggleReactionPicker = () => {
    if (!message._id) return;
    if (showReactionPicker) clearActiveMessage(message._id);
    else setActiveMessage(message._id);
  };

  const handleBubbleClick = (event: React.MouseEvent) => {
    if (!isMobile || isPending || !message._id) return;
    // Links, media controls and reaction chips inside the bubble do their
    // own thing on tap - don't also toggle the menu over them.
    if ((event.target as HTMLElement).closest("a, button, audio, video, input")) return;
    setActiveMessage(isActive ? null : message._id);
  };

  if (message.call) {
    return (
      <CallRecordRow
        call={message.call}
        isCaller={message.sender?.toLowerCase() === user?.email?.toLowerCase()}
        date={message.date}
      />
    );
  }

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

  const isRead = message.status === 'read';

  return (
    <div ref={containerRef} className={`flex flex-col ${isOwnMessage ? "items-start" : "items-end"}`}>
    <div
      className={`${messageRowStyle} w-full`}
      onMouseMove={handleRowMouseMove}
      onMouseLeave={handleRowMouseLeave}
    >
      <div onClick={handleBubbleClick}
        className={`${messageStyle} ${showMobileMenu ? "ring-2 ring-sky-400/80" : ""}`}
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

        {message.location && (
          <LocationBubble location={message.location} onOpen={openFullscreen} />
        )}

        {message.file?.contentType && <>
          {message.file?.contentType.includes("image")
            && message.file && (
              <Image
                onDoubleClick={() => {
                  if (isMobile) openFullscreen();
                }}
                onClick={() => {
                  if (!isMobile) openFullscreen();
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
        {reactionGroups.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {reactionGroups.map(group => {
              const includesMine = group.senders.some(
                sender => sender?.toLowerCase() === user?.email?.toLowerCase()
              );
              return (
                <button
                  key={group.emoji}
                  type="button"
                  onClick={event => {
                    // The bubble itself toggles the mobile action buttons -
                    // tapping a reaction must not also do that.
                    event.stopPropagation();
                    handleReact(group.emoji);
                  }}
                  title={group.senders
                    .map(sender => sender?.toLowerCase() === user?.email?.toLowerCase() ? "You" : AsShortName(sender))
                    .join(", ")}
                  aria-label={`${group.senders.length} reacted with ${group.emoji}`}
                  data-testid="reaction-chip"
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-sm leading-none transition-colors ${includesMine ? "bg-white/35 ring-1 ring-white/70" : "bg-black/25 hover:bg-black/35"
                    }`}
                >
                  <span>{group.emoji}</span>
                  <span className="text-xs tabular-nums">{group.senders.length}</span>
                </button>
              );
            })}
          </div>
        )}

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
      {/* Desktop-only hover strip - on mobile the same actions live in the
          menu under the bubble instead (below), since three icons beside a
          bubble that's already 80% wide don't fit a phone screen.
          The react button sits between the bubble and the reply/delete
          buttons on purpose: the desktop hover hitbox for those buttons is
          bounded by the delete button's right edge (own messages) or the
          bubble's left edge (received ones), so anything added outside that
          span would clear hover the moment the cursor reached it. */}
      {!isMobile && !isPending && (
        <div className="relative flex">
          <button
            type="button"
            ref={reactButtonRef}
            onClick={toggleReactionPicker}
            aria-label="React to message"
            aria-expanded={showReactionPicker}
            className="flex"
          >
            <SmilePlus
              className={hover || showReactionPicker ? 'block' : 'hidden'}
              size={26}
            />
          </button>

          {/* Portaled and fixed-position: the chat box scrolls (and so clips
              its overflow), and it can be shorter than the expanded picker. */}
          {showReactionPicker && pickerPosition && createPortal(
            <div
              ref={pickerRef}
              style={{ position: "fixed", ...pickerPosition }}
              className="z-50 rounded-2xl border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-700"
            >
              <ReactionPicker selected={myReaction?.emoji} onPick={handleReact} />
            </div>,
            document.body
          )}
        </div>
      )}

      {!isMobile && onReply && !isPending && (
        <button onClick={handleReply}
          className='flex'
          aria-label="Reply to message">
          <Reply
            className={hover ? 'block' : 'hidden'}
            size={28}
          />
        </button>
      )}

      {!isMobile && isOwnMessage && (
        <button onClick={deleteMessageHandler}
          ref={deleteButtonRef}
          className='flex'
          aria-label="Delete message">
          <TiDeleteOutline
            className={hover ? 'block' : 'hidden'}
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

      {isFullscreen && message.location && (
        <FullscreenLocationViewer
          location={message.location}
          onClose={() => setIsFullscreen(false)}
        />
      )}
    </div >

    {/* Mobile action menu. In the flow directly under the bubble (and on
        the bubble's own side) rather than floating beside it, so it can't
        run off the edge of a narrow screen and widen the page. */}
    {showMobileMenu && (
      <div
        ref={mobileMenuRef}
        role="group"
        aria-label="Message actions"
        data-testid="message-actions-menu"
        className="relative z-10 -mt-1.5 mb-3 w-fit max-w-full overflow-hidden rounded-2xl border border-gray-200 bg-white text-gray-900 shadow-lg md:-mt-4 md:mb-6 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
      >
        <ReactionPicker selected={myReaction?.emoji} onPick={handleReact} />
        {(onReply || isOwnMessage) && (
          <div className="flex flex-col border-t border-gray-200 py-1 dark:border-gray-600">
            {onReply && (
              <button
                type="button"
                onClick={handleReply}
                className="flex items-center gap-3 px-4 py-2 text-left text-base hover:bg-gray-100 dark:hover:bg-gray-600"
              >
                <Reply size={20} aria-hidden="true" />
                Reply
              </button>
            )}
            {isOwnMessage && (
              <button
                type="button"
                onClick={deleteMessageHandler}
                className="flex items-center gap-3 px-4 py-2 text-left text-base text-red-600 hover:bg-gray-100 dark:text-red-400 dark:hover:bg-gray-600"
              >
                <Trash2 size={20} aria-hidden="true" />
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    )}
    </div>
  );
};

export default MessageBubble;