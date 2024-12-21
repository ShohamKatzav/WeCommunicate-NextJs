"use client";

import { RefObject, useEffect, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";
import Message from "../types/message";
import fetchMessages from "../actions/message-actions";
import { Spinner } from "./spinner";
import { useUser } from "../hooks/useUser";
import MessageViewer from "./messageViewer";
import ChatUser from "../types/chatUser";


interface LoadMoreProps {
  chatBox: RefObject<HTMLDivElement>
  oldMessages: Message[]
  participant: ChatUser
}

const LoadMoreMessages = ({ chatBox, oldMessages, participant }: LoadMoreProps) => {
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
    const res: any = await fetchMessages(nextPage, participant._id!);
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
  }, [participant]);


  return (
    <>
      <div className="grid row-start-2 md:grid-cols-5">
        {messages.slice(newMessagesCount).map((message, index) =>
          <MessageViewer key={index + 5} message={message} email={user?.email} />)
        }
      </div>
      <div ref={newMessages} className="grid row-start-2 md:grid-cols-5">
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
