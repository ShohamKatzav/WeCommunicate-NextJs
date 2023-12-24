"use client"
import { useUser } from "../hooks/useUser";
import Message from "../types/message";
import MessageViewer from "./messageViewer";
import LoadMore from "./loadMore";
import { RefObject, useEffect, useState } from "react";

interface MessagesBoxProps {
    messages: Message[],
    chatBox: RefObject<HTMLDivElement>
}

const MessagesBox = ({ messages, chatBox }: MessagesBoxProps) => {
    const { user } = useUser();
    const [loadNew, setLoadNew] = useState(false);

    const handleScroll = () => {
        if (chatBox.current) {
            const isAtTop = chatBox.current.scrollTop === 0;
            if (isAtTop && !loadNew) {
                setLoadNew(true);
            }
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
    return (
        <>
            <div className="mt-8 md:mt-20">
                <div ref={chatBox} className="w-full flex flex-col md:flex-cols-4 overflow-y-auto h-80">
                    {loadNew &&
                        <LoadMore chatBox={chatBox}/>
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