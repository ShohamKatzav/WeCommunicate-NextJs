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
    participant: ChatUser
}

const MessagesBox = ({ messages, chatBox, participant }: MessagesBoxProps) => {
    const { user } = useUser();
    const [loadNew, setLoadNew] = useState(false);

    const handleScroll = () => {
        if (chatBox.current?.scrollTop === 0) {
            // this if fix for case I switch to conversation with less than 5 messages and dont need the fetching spinner
            if (chatBox.current?.clientHeight != chatBox.current?.scrollHeight)
                if (!loadNew)
                    setLoadNew(true);
        }
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
    }, [participant]);

    return (
        <>
            <div className="mt-8 md:mt-20">
                <div ref={chatBox} className="w-full flex flex-col md:flex-cols-4 overflow-y-auto h-96">
                    {loadNew &&
                        <LoadMoreMessages chatBox={chatBox} oldMessages={messages} participant={participant} />
                    }
                    <div className="grid row-start-2 md:grid-cols-5">
                        {messages.map((message, index) =>
                            <MessageViewer key={index} message={message} email={user?.email} />)
                        }
                    </div>
                </div>
            </div>
        </>
    );
}
export default MessagesBox;