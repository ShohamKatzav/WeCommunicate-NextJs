"use client"
import { useUser } from "../hooks/useUser";
import Message from "../types/message";
import MessageViewer from "./messageViewer";
import LoadMoreMessages from "./loadMoreMessages";
import { RefObject, useEffect, useState } from "react";
import ChatUser from "../types/chatUser";

interface MessagesBoxProps {
    messages: Message[],
    chatBox: RefObject<HTMLDivElement | null>
    participants: ChatUser[]
}

const MessagesBox = ({ messages, chatBox, participants }: MessagesBoxProps) => {
    const { user } = useUser();
    const [loadNew, setLoadNew] = useState(false);

    const handleScroll = () => {
        const isAtTop = (chatBox?.current?.clientHeight! + 1) + (chatBox?.current?.scrollTop! * -1) >= chatBox?.current?.scrollHeight!;
        if (isAtTop)
            setLoadNew(true);

    }

    useEffect(() => {
        const currentChatBox = chatBox?.current;
        if (currentChatBox) {
            currentChatBox.addEventListener('scroll', handleScroll);
        }
        return () => {
            if (currentChatBox) {
                currentChatBox.removeEventListener('scroll', handleScroll);
            }
        };
    }, [chatBox]);

    useEffect(() => {
        setLoadNew(false);
    }, [participants]);

    return (
        <>
            <div className="mt-8 md:mt-20">
                <div ref={chatBox} className="flex flex-col-reverse h-[30vh] overflow-y-scroll w-full p-2">
                    <div>
                        {messages.map((message, index) =>
                            <MessageViewer key={index} message={message} email={user?.email} />)
                        }
                    </div>
                    {chatBox?.current?.scrollTop != 0 && loadNew &&
                        <LoadMoreMessages oldMessages={messages} participants={participants} />
                    }
                </div>
            </div>
        </>
    );
}
export default MessagesBox;