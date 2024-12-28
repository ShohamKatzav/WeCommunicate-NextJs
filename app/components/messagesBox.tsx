"use client"
import { useUser } from "../hooks/useUser";
import Message from "../types/message";
import MessageViewer from "./messageViewer";
import LoadMoreMessages from "./loadMoreMessages";
import { RefObject, useEffect, useState } from "react";
import ChatUser from "../types/chatUser";

interface MessagesBoxProps {
    messages: Message[],
    chatBox: RefObject<HTMLDivElement>
    participants: ChatUser[]
}

const MessagesBox = ({ messages, chatBox, participants }: MessagesBoxProps) => {
    const { user } = useUser();
    const [loadNew, setLoadNew] = useState(false);

    const handleScroll = () => {
        const isAtTop = (chatBox.current?.clientHeight! + 1) + (chatBox.current?.scrollTop! * -1) >= chatBox.current?.scrollHeight!;
        if (isAtTop)
            setLoadNew(true);

    }

    useEffect(() => {
        const currentChatBox = chatBox.current;
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
                <div ref={chatBox} className="overflow-y-scroll h-[30vh] w-full flex md:flex-cols-4 flex-col-reverse">
                    <div className="grid row-start-2 md:grid-cols-5">
                        {messages.map((message, index) =>
                            <MessageViewer key={index} message={message} email={user?.email} />)
                        }
                    </div>
                    {chatBox.current?.scrollTop != 0 && loadNew &&
                        <LoadMoreMessages chatBox={chatBox} oldMessages={messages} participants={participants} />
                    }
                </div>
            </div>
        </>
    );
}
export default MessagesBox;