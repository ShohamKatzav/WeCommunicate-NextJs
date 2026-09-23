"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import { useInView } from "react-intersection-observer";
import Message from "@/types/message";
import ChatUser from "@/types/chatUser";
import { getMessages } from '@/app/lib/chatActions';
import { Spinner } from "../ui/spinner";
import MessageBubble from "./messageBubble";
import { accentForSender, accentsForReceivedBubbles } from "../../utils/accentColor";

interface LoadMoreProps {
  oldMessages: Message[];
  participants: ChatUser[];
  onReply: (message: Message) => void;
  clearedAt?: string;
}

export default function MoreMessagesLoader({ oldMessages, participants, onReply, clearedAt }: LoadMoreProps) {

  const [messages, setMessages] = useState<Message[]>([]);
  const [page, setPage] = useState(1);
  const [allDataFetched, setAllDataFetched] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [offline, setOffline] = useState(false);
  const [newMessagesCount, setNewMessagesCount] = useState(parseInt(process.env.NEXT_PUBLIC_MESSAGES_PER_PAGE || '5'));
  const [observerEnabled, setObserverEnabled] = useState(false);

  const { ref, inView } = useInView();

  const container = useRef<HTMLDivElement | null>(null);
  const participantsIdRef = useRef<string>('');

  const accentBySender = useMemo(() => accentsForReceivedBubbles(participants), [participants]);

  // Duplicate messages fix - If user sent message and try to load more message, RSC and this component might not sync
  // Create a Set of message IDs from oldMessages to check for duplicates
  const oldMessageIds = useMemo(() => {
    return new Set(oldMessages.map(m => m._id).filter(Boolean));
  }, [oldMessages]);

  // Filter out messages that are already in oldMessages
  const uniqueLoadedMessages = useMemo(() => {
    return messages.filter(msg => !oldMessageIds.has(msg._id));
  }, [messages, oldMessageIds]);

  const loadMoreMessages = async (currentParticipantsId: string) => {
    if (fetching || allDataFetched || offline) return;

    setFetching(true);
    const nextPage = page + 1;
    try {
      const res: any = await getMessages(
        participants?.map(p => p._id).filter((id): id is string => id !== undefined),
        nextPage
      );

      if (res?.offline) {
        setOffline(true);
        return;
      }

      if (participantsIdRef.current !== currentParticipantsId) {
        return;
      }

      if (res?.message === "All data fetched" ||
        res?.message === "No conversation exists between the users") {
        setAllDataFetched(true);
      }

      // Drop any row at or before a pending local clear (see
      // usePendingCleanHistory) - the server doesn't know about this cutoff
      // yet while it's only queued locally, so it would otherwise still
      // return these rows.
      const rawMessages = res?.chat ?? [];
      const newMessages = clearedAt
        ? rawMessages.filter((m: Message) => new Date(m.date!).getTime() > new Date(clearedAt).getTime())
        : rawMessages;
      if (newMessages.length > 0) {
        setNewMessagesCount(newMessages.length);
        setMessages((prevMessages: Message[]) => {
          // Filter out any duplicates from new messages
          const existingIds = new Set(prevMessages.map(m => m._id));
          const uniqueNew = newMessages.filter((m: Message) => !existingIds.has(m._id));
          return [...uniqueNew, ...prevMessages];
        });
        setPage(nextPage);
      } else {
        setAllDataFetched(true);
      }
    } catch (err: any) {
      // Browser throws BEFORE SW fallback for server actions
      if (err?.message?.includes("Unexpected response") ||
        err?.message?.includes("Failed to fetch") ||
        navigator.onLine === false
      ) {
        setOffline(true);
        return;
      }

      console.error("Unexpected error:", err);
    }
    finally {
      if (participantsIdRef.current === currentParticipantsId) {
        setFetching(false);
      }
    }
  };

  useEffect(() => {
    if (!observerEnabled || fetching || allDataFetched || !inView) return;
    loadMoreMessages(participantsIdRef.current);
  }, [inView, fetching, allDataFetched, observerEnabled]);

  useEffect(() => {
    if (!oldMessages || oldMessages.length === 0) {
      setMessages([]);
      setPage(1);
      setAllDataFetched(true);
      setFetching(false);
    }
  }, [oldMessages]);

  useEffect(() => {
    const newParticipantsId = participants?.map(p => p._id).sort().join('-') || Date.now().toString();
    participantsIdRef.current = newParticipantsId;

    setObserverEnabled(false);
    setMessages([]);
    setPage(1);
    setAllDataFetched(false);
    setFetching(false);

    const timeout = setTimeout(() => {
      if (participantsIdRef.current === newParticipantsId) {
        setObserverEnabled(true);
      }
    }, 100);

    return () => clearTimeout(timeout);
  }, [participants]);

  // A clear applying to the open conversation permanently hides everything
  // at or before it - there's no more older history to page in, ever, so
  // this both drops whatever older pages were already loaded and stops
  // further fetches for this room (matches allDataFetched staying true even
  // after the clear syncs and the local pending record is dropped - the
  // server's own cutoff, read via getMessages' cleanHistoryTime filter,
  // keeps enforcing the same thing from then on).
  useEffect(() => {
    if (!clearedAt) return;
    setMessages([]);
    setPage(1);
    setAllDataFetched(true);
    setFetching(false);
  }, [clearedAt]);

  const messagesPerPage = parseInt((process.env.NEXT_PUBLIC_MESSAGES_PER_PAGE) || '5');

  return (
    <>
      <div ref={container}>
        {uniqueLoadedMessages.slice(newMessagesCount).map((message, index) =>
          <MessageBubble
            key={message._id || `old-${index}`}
            message={message}
            onReply={onReply}
            senderAccentColor={accentForSender(accentBySender, message.sender)}
          />
        )}
      </div>
      <div>
        {uniqueLoadedMessages.slice(0, newMessagesCount).map((message, index) =>
          <MessageBubble
            key={message._id || `new-${index}`}
            message={message}
            onReply={onReply}
            senderAccentColor={accentForSender(accentBySender, message.sender)}
          />
        )}
      </div>

      <div className="flex justify-center items-center" ref={ref}>
        {inView && !allDataFetched && observerEnabled && oldMessages?.length >= messagesPerPage && (
          <Spinner />
        )}
      </div>
    </>
  );
}