"use client"
import { useState, useEffect } from "react";
import Message from "../types/message";
import Image from "next/image";
import Link from "next/link";
import Loading from "./loading";
import useIsMedium from "../hooks/useIsMedium";

interface MessageViewerProps {
  message: Message;
  email?: string;
}

const MessageViewer = ({ message, email }: MessageViewerProps) => {
  const [type, setType] = useState("text");
  const sender = message.sender === email ? "You" : message.sender;
  const dateToDisplay = new Date(message.date!).toLocaleString();
  const isMedium = useIsMedium();

  useEffect(() => {
    const contentType = message.file?.contentType;
    if (!contentType) return;

    if (contentType.includes("image")) setType("image");
    else if (contentType.includes("audio")) setType("audio");
    else if (contentType.includes("video")) setType("video");
    else setType("link");

  }, [message.file?.contentType]);

  if (!type) return <Loading />;

  return (
    <div
      className={`self-start max-w-[80%] md:max-w-[60%] px-4 py-3 overflow-hidden ${message.sender === email
        ? "bg-blue-400 rounded-br-3xl justify-self-start"
        : "bg-slate-400 rounded-bl-3xl col-start-2 md:col-start-3 justify-self-end"
        } rounded-tl-3xl rounded-tr-xl text-white wrap-break-word overflow-auto gap-6 mb-6`}
    >
      <div className="text-sm md:text-lg text-gray-200 mb-1">{sender}</div>

      {message.text && (
        <div className="text-lg md:text-2xl wrap-break-word">{message.text}</div>
      )}

      {type === "image" && message.file && (
        <Image
          src={message.file.url}
          width={isMedium ? 250 : 100}
          height={isMedium ? 250 : 100}
          alt="Sent image"
        />
      )}

      {type === "audio" && message.file && (
        <audio controls>
          <source src={message.file.url} type="audio/mpeg" />
          Your browser does not support the audio element.
        </audio>
      )}

      {type === "video" && message.file && (
        <video width="320" height="240" controls preload="none">
          <source src={message.file.url} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      )}

      {type === "link" && message.file?.downloadUrl && (
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

      <div className="text-xs md:text-sm text-gray-200 mt-1 text-right">
        {dateToDisplay}
      </div>
    </div>
  );
};

export default MessageViewer;