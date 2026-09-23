import { Dispatch, RefObject, SetStateAction, useCallback, useEffect, useState } from "react";
import { useUser } from "../../hooks/useUser";
import ChatUser from "@/types/chatUser";
import Message from "@/types/message";
import { AsShortName } from "../../utils/stringFormat";
import { getUsernames } from "../../lib/accountActions";

interface ChatCreationProps {
    isOpen: boolean;
    onClose: () => void;
    onParticipantsSelected?: () => void;
    title?: string;
    participants: RefObject<ChatUser[] | null | undefined>;
    conversationId: RefObject<string | null | undefined>;
    setChat: (newChat: Message[]) => void;
    conversationMode: string;
    setMobileSidebarOpen: Dispatch<SetStateAction<boolean>>;
}

const ChatCreationForm =
    ({ isOpen,
        onClose,
        onParticipantsSelected,
        title,
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
            if (!user?.token) return;
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
            onParticipantsSelected?.();
            onClose();
        };

        return isOpen ? (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-3">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-96 h-96 max-w-full flex flex-col border border-gray-200 dark:border-gray-700">
                    {
                        title ? <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">{title}</h2> :
                            conversationMode === 'group' ? <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">Create a new group</h2> :
                                <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">Select a friend</h2>
                    }
                    <div className="flex flex-col flex-1 min-h-0">
                        {
                            conversationMode === 'group' &&
                            <label className="text-2xl block font-medium mb-2 text-gray-900 dark:text-gray-100">
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
                                        !(participant.email && user?.email && participant.email.toUpperCase() === user.email.toUpperCase())
                                    )
                                    .map((participant: ChatUser, index) => {
                                        const shortName = AsShortName(participant.email!);
                                        const isVisible = shortName.toUpperCase().includes(participantsSearch.toUpperCase());

                                        return (
                                            <div className="text-xl text-gray-800 dark:text-gray-100" key={participant?._id}>
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
                            className="bg-primary text-primary-foreground px-4 py-2 rounded hover:opacity-90"
                        >
                            {conversationMode === 'group' ? 'Create Group' : 'Start chatting'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>) : null
    };

export default ChatCreationForm;