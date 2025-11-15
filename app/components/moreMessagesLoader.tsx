"use client";
import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";
import Message from "@/types/message";
import ChatUser from "@/types/chatUser";
import { getMessages } from '@/app/lib/chatActions'
import { Spinner } from "./spinner";
import MessageBubble from "./messageBubble";


interface LoadMoreProps {
  oldMessages: Message[];
  participants: ChatUser[];
}

export default function MoreMessagesLoader({ oldMessages, participants }: LoadMoreProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [page, setPage] = useState(1);
  const [allDataFetched, setAllDataFetched] = useState(false);
  const [fetching, setFetching] = useState(false);

  const { ref, inView } = useInView();

  const [newMessagesCount, setNewMessagesCount] = useState(parseInt(process.env.MESSAGES_PER_PAGE || '5'));

  const loadMoreMessages = async () => {
    if (fetching || allDataFetched) return;
    setFetching(true);
    setAllDataFetched(false);
    const nextPage = page + 1;
    try {
      const res: any = await getMessages(
        participants?.map(p => p._id).filter((id): id is string => id !== undefined),
        nextPage
      );
      if (res?.message !== "success") {
        setAllDataFetched(true);
      }
      const newMessages = res?.chat ?? [];
      if (newMessages.length > 0) {
        setNewMessagesCount(res.chat.length);
        setMessages((prevMessages: Message[]) => [...newMessages, ...prevMessages]);
      }
      setPage(nextPage);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (fetching || allDataFetched) return;
    if (inView && !fetching) {
      loadMoreMessages();
    }
  }, [inView, fetching]);

  // aka intialize chat history
  useEffect(() => {
    if (oldMessages.length === 0) {
      setMessages([]);
    }
  }, [oldMessages]);

  useEffect(() => {
    setMessages([]);
  }, [participants]);


  return (
    <>
      <div>
        {messages.slice(newMessagesCount).map((message, index) =>
          <MessageBubble key={index + parseInt(process.env.MESSAGES_PER_PAGE || '5')} message={message} />)
        }
      </div>
      <div>
        {messages.slice(0, newMessagesCount).map((message, index) =>
          <MessageBubble key={index} message={message} />)
        }
      </div>
      <div
        className="flex justify-center items-center"
        ref={ref}
      >
        {!allDataFetched && <Spinner />}
      </div>
    </>);


}
