"use client"
import Message from "@/types/message";
import MessageReaction from "@/types/messageReaction";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { deleteMessage, editMessage, toggleMessageReaction } from '@/app/lib/chatActions'
import { useUser } from "@/app/hooks/useUser";
import { useSocket } from "@/app/hooks/useSocket";
import useIsMobile from '@/app/hooks/useIsMobile';
import { IoBan } from "react-icons/io5";
import { TbClockQuestion } from "react-icons/tb";
import { Check, CheckCheck, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import FullscreenMediaViewer from './fullscreenMediaViewer';
import AudioPlayer from './audioPlayer';
import LocationBubble from './locationBubble';
import FullscreenLocationViewer from './fullscreenLocationViewer';
import CallRecordRow from './callRecordRow';
import MessageActionsMenu from './messageActionsMenu';
import { clearActiveMessage, setActiveMessage, useIsActiveMessage } from './activeMessageStore';
import { AsShortName } from "../../utils/stringFormat";
import { linkifyText } from "../../utils/linkify";
import { DEFAULT_ACCENT_COLOR, MAX_MESSAGE_LENGTH, REPLY_SNIPPET_LENGTH, WARNINGS_BEFORE_BAN } from "../../config/limits";

interface MessageBubbleProps {
  message: Message;
  onReply?: (message: Message) => void;
  senderAccentColor?: string;
}

const MessageBubble = ({ message, onReply, senderAccentColor }: MessageBubbleProps) => {

  const { user } = useUser();
  const { socket } = useSocket();
  const isMobile = useIsMobile();

  const messageRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState(false);
  // Set once an action has been used from the desktop actions menu, so its
  // button stays hidden while the cursor is still resting on the row instead
  // of reappearing on the very next mousemove - it comes back after the
  // cursor leaves the message, in any direction, and returns.
  const hoverSuppressed = useRef(false);
  // Whether the cursor was last seen on this message's hover area (see
  // handleRowMouseMove), for deciding whether an action suppresses hover.
  const pointerInside = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [deleted, setDeleted] = useState(
    message.status?.includes("revoked") ?? false
  );
  // Seeded from the message as loaded, then kept current by this bubble's
  // own socket subscription below rather than by its parent - older pages
  // are rendered from MoreMessagesLoader's separate list, which the chat
  // state a parent-owned handler updates never reaches.
  const [reactions, setReactions] = useState<MessageReaction[]>(message.reactions || []);
  // Same reasoning as reactions: an edit (this message's, or the one its
  // reply quotes) has to reach bubbles on older pages too. An override only
  // holds while the prop is still what it was when the edit arrived - once
  // the parent's list catches up (or moves past it), the prop wins again.
  const [textOverride, setTextOverride] = useState<{ from?: string; text: string } | null>(null);
  const [snippetOverride, setSnippetOverride] = useState<{ from?: string; snippet: string } | null>(null);
  const hasTextOverride = textOverride !== null && textOverride.from === message.text;
  const text = hasTextOverride ? textOverride.text : message.text;
  const edited = hasTextOverride || !!message.edited;
  const replySnippet = snippetOverride !== null && snippetOverride.from === message.replyTo?.snippet
    ? snippetOverride.snippet
    : message.replyTo?.snippet;
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  // Only one message at a time has its actions menu open (see
  // activeMessageStore.ts).
  const showMenu = useIsActiveMessage(message._id);

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

    const repliedToId = message.replyTo?.messageId;
    const handleEdit = (edit: Pick<Message, '_id' | 'text'>) => {
      if (typeof edit?.text !== 'string') return;
      if (edit._id === message._id) {
        setTextOverride({ from: message.text, text: edit.text });
      } else if (repliedToId && edit._id === repliedToId) {
        setSnippetOverride({ from: message.replyTo?.snippet, snippet: edit.text.slice(0, REPLY_SNIPPET_LENGTH) });
      }
    };

    socket.on("message reactions", handleReactions);
    socket.on("edit message", handleEdit);
    return () => {
      socket.off("message reactions", handleReactions);
      socket.off("edit message", handleEdit);
    };
  }, [socket, message._id, message.text, message.replyTo?.messageId, message.replyTo?.snippet]);

  useEffect(() => {
    if (!showMenu || !message._id) return;
    const id = message._id;

    // Any click outside the menu closes it - including the empty part of
    // this message's row, which spans the chat's full width (exempting the
    // row left a dead strip beside the bubble). Clicks on the bubble
    // (mobile) or the actions button (desktop) toggle the menu in their own
    // handlers, which run before this document listener; so does another
    // bubble's, which makes that one active and the clear below a no-op.
    // That's also why this is click rather than pointerdown: tapping a
    // different bubble moves the menu there in one tap.
    // React can attach this listener while the click that opened the menu
    // is still on its way up to the document, so that click is skipped by
    // its timestamp rather than closing the menu it just opened.
    const listeningSince = performance.now();
    const handleClickOutside = (event: MouseEvent) => {
      if (event.timeStamp < listeningSince) return;
      if (menuRef.current?.contains(event.target as Node)) return;
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
  }, [showMenu, message._id]);

  // A bubble that unmounts (deleted, scrolled out of the loaded pages, or
  // in a conversation the user just left) mustn't stay registered as the
  // open one.
  useEffect(() => {
    const id = message._id;
    if (!id) return;
    return () => clearActiveMessage(id);
  }, [message._id]);

  // Any action taken closes the actions it was taken from.
  const closeActions = () => {
    if (message._id) clearActiveMessage(message._id);
    if (!isMobile) {
      // Only while the cursor is actually on the message (a reaction chip,
      // or the menu's top row where it overlaps). An action picked lower in
      // the menu leaves the cursor below the message, and nothing would
      // ever clear the suppression before the cursor came back to it.
      if (pointerInside.current) hoverSuppressed.current = true;
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

  const startEdit = () => {
    closeActions();
    setDraft(text ?? "");
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setDraft("");
  };

  // Waits for the server rather than showing the new text straight away:
  // unlike a reaction, an edit can be turned down by moderation. On any
  // failure the editor stays open with the draft, so it can be fixed or
  // cancelled.
  const submitEdit = async () => {
    if (!message._id || savingEdit) return;
    const newText = draft.trim();
    if (!newText) {
      toast.warning("A message can't be empty.");
      return;
    }
    if (newText === text) {
      cancelEdit();
      return;
    }

    setSavingEdit(true);
    try {
      const result = await editMessage(message._id, newText);
      if (!result.success) {
        if (result.punishment?.includes("ban")) {
          const banMessage = result.bannedUntil
            ? `You've been temporarily banned until ${new Date(result.bannedUntil).toLocaleString()}. Reason: ${result.reason}`
            : `You've been permanently banned. Reason: ${result.reason}`;
          socket?.emit('ban user', { userEmail: user?.email, message: banMessage });
        } else if (result.punishment === 'warning') {
          toast.warning(`Warning ${result.warningCount}/${WARNINGS_BEFORE_BAN}: ${result.reason}`, { duration: 7000 });
        } else if (result.banned) {
          toast.error(result.message || 'Your account is banned from sending messages.', { duration: 10000 });
        } else {
          toast.error(result.message || "Couldn't edit that message.");
        }
        return;
      }
      if (!result.unchanged) {
        setTextOverride({ from: message.text, text: result.text });
        socket?.emit("edit message", { messageId: message._id });
      }
      cancelEdit();
    } catch {
      // Edits aren't part of the offline outbox - the service worker turns
      // the call away while offline, so nothing was saved.
      toast.info("Couldn't edit that message while you're offline.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleEditKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter saves, like Enter sends in the chat input - messages are single
    // line there, so an edit shouldn't be able to add line breaks either.
    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submitEdit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
    }
  };

  // Shared by the media (photo/video) and location bubbles below - same
  // fullscreen behavior either way, just a different viewer rendered at the
  // bottom of this component depending on which the message actually has.
  const openFullscreen = () => {
    setIsFullscreen(true);
  };

  // Desktop hover hitbox for the actions button: tracked on the row (bubble
  // + button together) rather than the bubble alone, so crossing from the
  // bubble onto the button doesn't cross a gap that clears hover first. But
  // the row is a full-width block (it has to be, to justify-start/end the
  // bubble to the correct side - see messageRowStyle), so it reaches far
  // past the button into empty space. Gate on cursor X too: the button
  // trails own bubbles (left-aligned, empty space to the right) and leads
  // received ones (right-aligned, empty space to the left), so tracking
  // stops at the button's outer edge either way.
  const handleRowMouseMove = (e: React.MouseEvent) => {
    if (isMobile) return;
    const edges = (triggerRef.current ?? messageRef.current)?.getBoundingClientRect();
    // The height check is for the actions menu: it's portaled, but React
    // still delivers its mouse moves here, even though it sits below the
    // row on screen.
    const row = e.currentTarget.getBoundingClientRect();
    const inside = e.clientY >= row.top && e.clientY < row.bottom &&
      (!edges || (isOwnMessage ? e.clientX <= edges.right : e.clientX >= edges.left));
    pointerInside.current = inside;
    // Crossing that edge into the empty part of the row counts as leaving,
    // same as onMouseLeave below: it's still inside the full-width row, so
    // mouseleave never fires, and the button would otherwise stay hidden
    // after an action until the cursor left through the top or bottom.
    if (!inside) hoverSuppressed.current = false;
    setHover(inside && !hoverSuppressed.current);
  };

  const handleRowMouseLeave = () => {
    if (isMobile) return;
    pointerInside.current = false;
    hoverSuppressed.current = false;
    setHover(false);
  };

  const isPending = !message._id?.match(/^[a-f0-9]{24}$/);

  const handleReply = () => {
    closeActions();
    onReply?.(message);
  };

  // A message still waiting to send can't be reacted to or replied to yet,
  // but your own can still be deleted (the service worker queues that).
  const hasActions = (!isPending || isOwnMessage) && !isEditing;

  // Only text can be edited: not a pin, and not a file or voice message sent
  // without any (a deleted message or call record never gets this far).
  const canEdit = isOwnMessage && !isPending && !!text?.trim() && !message.location;

  const toggleMenu = () => {
    if (!message._id) return;
    setActiveMessage(showMenu ? null : message._id);
  };

  const handleBubbleClick = (event: React.MouseEvent) => {
    if (!isMobile || !hasActions) return;
    // Links, media controls and reaction chips inside the bubble do their
    // own thing on tap - don't also toggle the menu over them.
    if ((event.target as HTMLElement).closest("a, button, audio, video, input, textarea")) return;
    toggleMenu();
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

  // Desktop's way into the actions menu: one button beside the bubble,
  // shown on hover, instead of a row of react/reply/delete icons. It sits
  // on the side facing the middle of the chat - after own bubbles (which
  // are on the left), before received ones (on the right). Mobile opens the
  // same menu by tapping the bubble. opacity rather than hidden/invisible
  // keeps the button focusable and its space reserved, so revealing it
  // never shifts the bubble.
  const actionsTrigger = !isMobile && hasActions && (
    <button
      type="button"
      ref={triggerRef}
      onClick={toggleMenu}
      aria-label="Message actions"
      aria-haspopup="true"
      aria-expanded={showMenu}
      data-testid="message-actions-trigger"
      className={`mx-1 mb-3 md:mb-6 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-opacity hover:bg-foreground/10 hover:text-foreground focus-visible:opacity-100 ${hover || showMenu ? "opacity-100" : "opacity-0"
        } ${showMenu ? "bg-foreground/10 text-foreground" : ""}`}
    >
      <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
    </button>
  );

  return (
    <div
      className={messageRowStyle}
      onMouseMove={handleRowMouseMove}
      onMouseLeave={handleRowMouseLeave}
    >
      {!isOwnMessage && actionsTrigger}
      <div onClick={handleBubbleClick}
        className={`${messageStyle} ${showMenu && isMobile ? "ring-2 ring-sky-400/80" : ""}`}
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
            <div className="line-clamp-2 opacity-90">{replySnippet || "Attachment"}</div>
          </div>
        )}

        {isEditing ? (
          <div className="flex w-72 max-w-full flex-col gap-2 md:w-96">
            <textarea
              value={draft}
              onChange={event => setDraft(event.target.value)}
              onKeyDown={handleEditKeyDown}
              onFocus={event => {
                const end = event.currentTarget.value.length;
                event.currentTarget.setSelectionRange(end, end);
              }}
              autoFocus
              rows={3}
              maxLength={MAX_MESSAGE_LENGTH}
              disabled={savingEdit}
              aria-label="Edit message"
              data-testid="edit-message-input"
              className="w-full resize-none rounded-lg border border-white/40 bg-black/25 p-2 text-base text-white placeholder:text-white/70 focus:outline-none focus:ring-2 focus:ring-white/80 md:text-lg"
            />
            <div className="flex justify-end gap-2 text-sm">
              <button
                type="button"
                onClick={cancelEdit}
                disabled={savingEdit}
                className="rounded-md px-3 py-1 text-white hover:bg-white/15 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitEdit}
                disabled={savingEdit || !draft.trim()}
                data-testid="edit-message-save"
                className="rounded-md bg-white/25 px-3 py-1 font-medium text-white hover:bg-white/35 disabled:opacity-60"
              >
                {savingEdit ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        ) : text && (
          <div className="text-lg md:text-2xl wrap-break-word">{linkifyText(text)}</div>
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
          {edited && <span className="italic" data-testid="edited-label">Edited</span>}
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
      {isOwnMessage && actionsTrigger}

      {showMenu && (
        <MessageActionsMenu
          anchorRef={isMobile ? messageRef : triggerRef}
          align={isOwnMessage ? "start" : "end"}
          menuRef={menuRef}
          selectedReaction={myReaction?.emoji}
          onReact={isPending ? undefined : handleReact}
          onReply={onReply && !isPending ? handleReply : undefined}
          onEdit={canEdit ? startEdit : undefined}
          onDelete={isOwnMessage ? deleteMessageHandler : undefined}
          onDismiss={() => { if (message._id) clearActiveMessage(message._id); }}
        />
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
  );
};

export default MessageBubble;