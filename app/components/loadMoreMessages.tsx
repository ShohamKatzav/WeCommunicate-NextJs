"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";
import Message from "../types/message";
import fetchMessages from "../actions/message-actions";
import { Spinner } from "./spinner";
import { useUser } from "../hooks/useUser";
import MessageViewer from "./messageViewer";
import ChatUser from "../types/chatUser";


interface LoadMoreProps {
  oldMessages: Message[]
  participants: ChatUser[]
}

const LoadMoreMessages = ({ oldMessages, participants }: LoadMoreProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [page, setPage] = useState(1);
  const [allDataFetched, setAllDataFetched] = useState(false);
  const [fetching, setFetching] = useState(false);

  const { ref, inView } = useInView();
  const { user } = useUser();

  const newMessages = useRef<HTMLDivElement>(null);
  const [newMessagesCount, setNewMessagesCount] = useState(5);

  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const loadMoreMessages = async () => {
    setFetching(true);
    setAllDataFetched(false);
    await delay(200);
    const nextPage = page + 1;
    const res: any = await fetchMessages(
      nextPage,
      participants?.map(p => p._id).filter((id): id is string => id !== undefined)
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
  };

  useEffect(() => {
    if (inView && !fetching) {
      loadMoreMessages();
      setFetching(false);
    }
  }, [inView]);

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
          <MessageViewer key={index + 5} message={message} email={user?.email} />)
        }
      </div>
      <div>
        {messages.slice(0, newMessagesCount).map((message, index) =>
          <MessageViewer key={index} message={message} email={user?.email} />)
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
export default LoadMoreMessages;
