import { Dispatch, RefObject, SetStateAction, useCallback, useEffect, useState } from "react";
import { useUser } from "../hooks/useUser";
import ChatUser from "@/types/chatUser";
import Message from "@/types/message";
import { AsShortName } from "../utils/stringFormat";
import { getUsernames } from "../lib/accountActions";

interface ChatCreationProps {
    isOpen: boolean;
    onClose: () => void;
    participants: RefObject<ChatUser[] | null | undefined>;
    conversationId: RefObject<string | null | undefined>;
    setChat: Dispatch<SetStateAction<Message[]>>;
    conversationMode: string;
    setMobileSidebarOpen: Dispatch<SetStateAction<boolean>>;
}

const ChatCreationForm =
    ({ isOpen,
        onClose,
        participants,
        conversationId,
        setChat,
        conversationMode,
        setMobileSidebarOpen }: ChatCreationProps) => {

        const [participantsList, setParticipantsList] = useState<ChatUser[]>([]);
        const [selectedParticipants, setSelectedParticipants] = useState<ChatUser[]>([]);
        const [participantsSearch, setParticipantsSearch] = useState<string>("");

        const { user } = useUser();

        const fetchUsers = useCallback(async () => {
            if (!user?.email) return;
            try {
                const response: ChatUser[] = await getUsernames();
                setParticipantsList(response);
            } catch (err) {
                console.error('Failed to fetch usernames', err);
            }
        }, [isOpen]);

        useEffect(() => {
            setSelectedParticipants([]);
            fetchUsers();
        }, [isOpen]);

        const membersSelectChange = (input: HTMLInputElement, participant: ChatUser) => {
            if (conversationMode === 'single') {
                setSelectedParticipants([participant]);
            }
            else {
                const isChecked = input.checked;
                if (isChecked) {
                    setSelectedParticipants((prev) => [...prev, participant]);
                } else {
                    setSelectedParticipants((prev) => prev.filter((item) => item !== participant));
                }
            }
            setMobileSidebarOpen(false);
        };

        const groupCreation = () => {
            participants.current = selectedParticipants;
            conversationId.current = '';
            setChat([]);
            setSelectedParticipants([]);
            onClose();
        };

        return isOpen ? (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-3">
                <div className="bg-white rounded-lg shadow-lg p-6 w-96 h-96 max-w-full flex flex-col">
                    {
                        conversationMode === 'group' ? <h2 className="text-3xl font-bold mb-4">Create a new group</h2> :
                            <h2 className="text-3xl font-bold mb-4">Select a friend</h2>
                    }
                    <div className="flex flex-col flex-1 min-h-0">
                        {
                            conversationMode === 'group' &&
                            <label className="text-2xl block font-medium mb-2">
                                Select Participants:
                            </label>
                        }
                        <input
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg
                focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700
                dark:border-gray-600 dark:placeholder-gray-400 dark:text-white
                dark:focus:ring-blue-500 dark:focus:border-blue-500"
                            placeholder="Start typing a participants name..."
                            type="text"
                            value={participantsSearch}
                            onChange={(e) => setParticipantsSearch(e.target.value)}
                        />
                        <div className="flex-1 overflow-y-auto mt-4 min-h-0">
                            {Array.isArray(participantsList) && participantsList.length > 0 &&
                                participantsList
                                    .filter((participant: ChatUser) =>
                                        participant.email?.toUpperCase() !== user?.email?.toUpperCase()
                                    )
                                    .map((participant: ChatUser, index) => {
                                        const shortName = AsShortName(participant.email!);
                                        const isVisible = shortName.toUpperCase().includes(participantsSearch.toUpperCase());

                                        return (
                                            <div className="text-xl" key={participant?._id}>
                                                <input
                                                    id={`participant-${index}`}
                                                    type={conversationMode === 'group' ? 'checkbox' : 'radio'}
                                                    name={conversationMode === 'group' ? undefined : 'participant'}
                                                    onChange={(e) => membersSelectChange(e.target as HTMLInputElement, participant)}
                                                    hidden={!isVisible}
                                                /> {" "}
                                                {isVisible &&
                                                    <label htmlFor={`participant-${index}`}>{shortName}</label>
                                                }
                                            </div>
                                        );
                                    })}
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <button
                            type="button"
                            onClick={groupCreation}
                            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                        >
                            {conversationMode === 'group' ? 'Create Group' : 'Start chatting'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>) : null
    };

export default ChatCreationForm;