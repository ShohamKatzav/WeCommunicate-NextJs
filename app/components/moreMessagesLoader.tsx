"use client";
import { useEffect, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";
import Message from "@/types/message";
import ChatUser from "@/types/chatUser";
import { getMessages } from '@/app/lib/chatActions';
import { Spinner } from "./spinner";
import MessageBubble from "./messageBubble";
import { useSocket } from "../hooks/useSocket";

interface LoadMoreProps {
  oldMessages: Message[];
  participants: ChatUser[];
}

export default function MoreMessagesLoader({ oldMessages, participants }: LoadMoreProps) {

  const [messages, setMessages] = useState<Message[]>([]);
  const [page, setPage] = useState(1);
  const [allDataFetched, setAllDataFetched] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [newMessagesCount, setNewMessagesCount] = useState(parseInt(process.env.NEXT_PUBLIC_MESSAGES_PER_PAGE || '5'));
  const [observerEnabled, setObserverEnabled] = useState(false);

  const { ref, inView } = useInView();
  const { socket, loadingSocket } = useSocket();

  const container = useRef<HTMLDivElement | null>(null);
  const participantsIdRef = useRef<string>('');

  // Listen for delete message events
  useEffect(() => {
    if (!socket || loadingSocket) return;

    const handleMessageDeleted = (deletedMessage: Message) => {
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg._id === deletedMessage._id
            ? { ...msg, status: 'revoked' }
            : msg
        )
      );
    };

    socket.on("delete message", handleMessageDeleted);

    return () => {
      socket.off("delete message", handleMessageDeleted);
    };
  }, [socket, loadingSocket]);

  const loadMoreMessages = async (currentParticipantsId: string) => {
    if (fetching || allDataFetched) return;

    setFetching(true);
    const nextPage = page + 1;
    try {
      const res: any = await getMessages(
        participants?.map(p => p._id).filter((id): id is string => id !== undefined),
        nextPage
      );

      if (participantsIdRef.current !== currentParticipantsId) {
        return;
      }

      if (res?.message === "All data fetched" ||
        res?.message === "No conversation exists between the users") {
        setAllDataFetched(true);
      }

      const newMessages = res?.chat ?? [];
      if (newMessages.length > 0) {
        setNewMessagesCount(newMessages.length);
        setMessages((prevMessages: Message[]) => [...newMessages, ...prevMessages]);
        setPage(nextPage);
      } else {
        setAllDataFetched(true);
      }
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

  const messagesPerPage = parseInt(process.env.NEXT_PUBLIC_MESSAGES_PER_PAGE || '5');

  return (
    <>
      <div ref={container}>
        {messages.slice(newMessagesCount).map((message, index) =>
          <MessageBubble key={message._id || `old-${index}`} message={message} />
        )}
      </div>
      <div>
        {messages.slice(0, newMessagesCount).map((message, index) =>
          <MessageBubble key={message._id || `new-${index}`} message={message} />
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