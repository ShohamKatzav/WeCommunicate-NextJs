"use client"
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from "react";
import ChatUser from "@/types/chatUser";
import Message from "@/types/message";
import useIsMobile from "../hooks/useIsMobile";
import ConversationSummary from "./conversationSummary";
import { getConversations } from '@/app/lib/conversationActions'

interface ConversationsPanelProps {
    getLastMessages: (participantFromList: ChatUser[]) => Promise<void>;
    newMessage: Message | undefined;
    participants: ChatUser[] | undefined;
    reloadKey: boolean;
}

const RecentConversationsPanel = ({ getLastMessages, newMessage, participants, reloadKey }: ConversationsPanelProps) => {
    const [conversations, setConversations] = useState<any>([]);
    const [loading, setLoading] = useState(true);
    const [fetchCode, setFetchCode] = useState(200);
    const isMobile = useIsMobile();

    const [toggle, setToggle] = useState(!isMobile);
    const dropRef = useRef<HTMLUListElement>(null);
    const openRef = useRef<HTMLDivElement>(null);
    const closeRef = useRef<HTMLDivElement>(null);

    const router = useRouter();


    const dropupHandler = () => {
        if (!toggle) {
            dropRef.current?.classList.add("hidden");
            openRef.current?.classList.add("hidden");
            closeRef.current?.classList.remove("hidden");
        } else {
            dropRef.current?.classList.remove("hidden");
            closeRef.current?.classList.add("hidden");
            openRef.current?.classList.remove("hidden");
        }
        setToggle(!toggle);
    };


    const fetchData = async () => {
        try {
            const fetchedConversations = await getConversations();
            setConversations(fetchedConversations.recentConversations);
        } catch (error: any) {
            setFetchCode(401);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setToggle(!isMobile);
    }, [isMobile]);

    useEffect(() => {
        fetchData();
    }, [reloadKey]);

    useEffect(() => {
        if (fetchCode === 401) router.replace('/login');
    }, [fetchCode, router]);

    useEffect(() => {
        if (newMessage && newMessage?.conversationID) {
            setConversations((prevConversations: any[]) => {
                const updatedConversations = [...prevConversations];

                const conversationIndex = updatedConversations.findIndex(
                    conversation => conversation._id.toUpperCase() === newMessage.conversationID?.toUpperCase()
                );

                if (conversationIndex > -1) {
                    // Update the existing conversation
                    const [conversation] = updatedConversations.splice(conversationIndex, 1);
                    conversation.messages = [newMessage, ...conversation.messages];
                    updatedConversations.unshift(conversation);
                } else {
                    const newConversation = {
                        _id: newMessage.conversationID,
                        members: participants,
                        messages: [newMessage],
                    };
                    updatedConversations.unshift(newConversation);
                }

                return updatedConversations;
            });
        }
    }, [newMessage]);

    return (
        <>
            <button type="button" className="min-w-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 focus:bg-gray-100 p-4 shadow rounded
        bg-white text-sm font-medium leading-none text-gray-800 flex items-center justify-between md:my-3.5 my-2" onClick={dropupHandler}>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white text-center flex-1">
                    Recent Conversations
                </h2>
                <div>
                    <div className="hidden" ref={closeRef}>
                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M5.00016 0.666664L9.66683 5.33333L0.333496 5.33333L5.00016 0.666664Z" fill="#1F2937" />
                        </svg>
                    </div>
                    <div ref={openRef}>
                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M5.00016 5.33333L0.333496 0.666664H9.66683L5.00016 5.33333Z" fill="#1F2937" />
                        </svg>
                    </div>
                </div>
            </button>
            {
                conversations?.length < 1 && loading ?
                    <div className="bg-white p-4 rounded-lg shadow-md flex items-center gap-4 hover:shadow-lg transition-shadow">
                        <p className="text-gray-600 text-center">Loading...</p></div> :
                    conversations?.length < 1 && !loading &&
                    <div className="bg-white p-4 rounded-lg shadow-md flex items-center gap-4 hover:shadow-lg transition-shadow">
                        <p className="text-gray-600 text-center">No recent conversations available.</p></div>
            }

            {toggle && conversations?.length > 0 && (
                <ul className="md:space-y-5 space-y-2">
                    {conversations.map((conversation: any) => {
                        return <ConversationSummary
                            conversation={conversation}
                            getLastMessages={getLastMessages}
                            setToggle={setToggle}
                            key={conversation._id} />
                    })}
                </ul>
            )
            }
        </>
    );
};

export default RecentConversationsPanel;
