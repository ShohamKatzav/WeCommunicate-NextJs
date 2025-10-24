import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { useNotification } from "../hooks/useNotification";
import { useUser } from "../hooks/useUser";
import useIsMedium from "../hooks/useIsMedium";
import ChatUser from "../types/chatUser";
import Conversation from "../types/conversation";
import { AsShortName } from "../utils/asName";

interface ConversationConversationSummaryProps {

    conversation: Conversation;
    getLastMessages: (participantsFromList: ChatUser[]) => Promise<void>;
    setToggle: Dispatch<SetStateAction<boolean>>
}

const ConversationSummary = ({ conversation, getLastMessages, setToggle }: ConversationConversationSummaryProps) => {

    const [otherMembers, setOtherMembers] = useState<ChatUser[]>();

    const { user } = useUser();
    const { initializeRoomNotifications, newMessageNotification } = useNotification();
    const isMediumScreen = useIsMedium();

    const incoming = newMessageNotification[conversation._id!];

    useEffect(() => {
        const temp = conversation.members.filter(
            (member: ChatUser) =>
                member.email?.toUpperCase() !== user?.email?.toUpperCase()
        );
        setOtherMembers(temp);
    }, [conversation.members]);

    const switchRoom = (otherMembers: ChatUser[]) => {
        initializeRoomNotifications(conversation._id!);
        getLastMessages(otherMembers);
        if (!isMediumScreen)
            setToggle(false);
    }

    return (
        otherMembers && <li
            className="bg-white p-4 rounded-lg shadow-md flex items-center gap-4 hover:shadow-lg transition-shadow"
            onClick={() => switchRoom(otherMembers)}
        >
            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-lg font-semibold text-gray-600">
                {otherMembers.length <= 3 ? (
                    otherMembers.map((member, index) => (
                        <span key={index}>
                            {AsShortName(member.email!)[0]}
                            {index < otherMembers.length - 1 ? ", " : ""}
                        </span>
                    ))
                ) : (
                    <>
                        {AsShortName(otherMembers[0].email!)[0]},
                        {AsShortName(otherMembers[1].email!)[0]}
                        <span> +{otherMembers.length - 2}</span>
                    </>
                )}
            </div>
            <div className="flex-1">
                <div className="text-gray-800 font-medium text-lg">
                    {otherMembers.length <= 3 ? (
                        otherMembers.map((member, index) => (
                            <span key={index}>
                                {AsShortName(member.email!)}
                                {index < otherMembers.length - 1 ? ", " : ""}
                            </span>
                        ))
                    ) : (
                        <>
                            {AsShortName(otherMembers[0].email!)}
                            {", "}
                            {AsShortName(otherMembers[1].email!)}
                            {", "}
                            {AsShortName(otherMembers[2].email!)}
                            <span> +{otherMembers.length - 3}</span>
                        </>
                    )}
                </div>
                {conversation.messages && conversation.messages.length > 0 ? (
                    <div className="text-gray-600 text-sm relative">
                        <span className="font-semibold text-gray-800">
                            {conversation.messages[0].sender?.toUpperCase() === user?.email?.toUpperCase() ? 'You' :
                                conversation.messages[0].sender?.split("@")[0]}
                        </span>
                        : {conversation.messages[0].value}
                        <div className="text-xs text-gray-400">
                            {conversation.messages[0].date &&
                                new Date(conversation.messages[0].date).toLocaleString()}
                        </div>
                        {incoming > 0 &&
                            <span className="inline-flex items-center justify-center px-2 py-1
                                text-xl font-bold leading-none text-white 
                                bg-red-600 rounded-full absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2">
                                {incoming}
                            </span>
                        }
                    </div>
                ) : (
                    <div className="text-gray-500 text-sm italic">
                        No messages yet.
                    </div>
                )}
            </div>
        </li>
    );
};

export default ConversationSummary;