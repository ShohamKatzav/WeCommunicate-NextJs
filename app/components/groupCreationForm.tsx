import React, { Dispatch, MutableRefObject, SetStateAction, useEffect, useState } from "react";
import ChatUser from "../types/chatUser";
import { getChatUsersList } from '../actions/cookie-actions';
import { AsShortName } from "../utils/asName";
import Message from "../types/message";
import { useUser } from "../hooks/useUser";
import AxiosWithAuth from "../utils/axiosWithAuth";

interface GroupCreationProps {
    isOpen: boolean;
    onClose: () => void;
    participants: MutableRefObject<ChatUser[] | null | undefined>;
    conversationId: MutableRefObject<string | null | undefined>;
    setChat: Dispatch<SetStateAction<Message[]>>;
}

const GroupCreationForm = ({ isOpen, onClose, participants, conversationId, setChat }: GroupCreationProps) => {

    const baseUrl = process.env.NEXT_PUBLIC_BASE_ADDRESS + "api/account";

    const [participantsList, setparticipantsList] = useState([]);
    const [selectedParticipants, setSelectedParticipants] = useState<ChatUser[]>([]);
    const [participantsSearch, setParticipantsSearch] = useState<string>("");

    const { user } = useUser();


    useEffect(() => {
        getUsersListFromCoockie();
    }, []);

    useEffect(() => {
        setSelectedParticipants([]);
    }, [isOpen]);

    const getUsersListFromCoockie = async () => {
        const chatUsers = await getChatUsersList();
        if (chatUsers)
            setparticipantsList(JSON.parse(chatUsers?.value));
        else {
            const response: any = await AxiosWithAuth().get(`${baseUrl}/get-usernames`);
            setparticipantsList(response?.data);
        }
    }

    const selectChange = (checkbox: HTMLInputElement, participant: ChatUser) => {
        const isChecked = checkbox.checked;

        if (isChecked) {
            setSelectedParticipants((prev) => [...prev, participant]);
        } else {
            setSelectedParticipants((prev) => prev.filter((item) => item !== participant));
        }
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
                <h2 className="text-3xl font-bold mb-4">Create New Group</h2>
                <div className="flex flex-col flex-1">
                    <label className="text-2xl block font-medium mb-2">
                        Select Participants:
                    </label>
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
                    <div className="flex-1 overflow-y-auto mt-4">
                        {participantsList.length > 0 &&
                            participantsList
                                .filter((participant: ChatUser) =>
                                    participant.email?.toUpperCase() !== user?.email?.toUpperCase()
                                )
                                .map((participant: ChatUser) => {
                                    const shortName = AsShortName(participant.email!);
                                    const isVisible = shortName.toUpperCase().includes(participantsSearch.toUpperCase());

                                    return (
                                        <div className="text-xl" key={participant._id}>
                                            <input
                                                type="checkbox"
                                                onChange={(e) =>
                                                    selectChange(e.target as HTMLInputElement, participant)
                                                }
                                                hidden={!isVisible}
                                            />{" "}
                                            {isVisible && AsShortName(participant.email!)}
                                        </div>
                                    );
                                })}
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <button
                            type="button"
                            onClick={groupCreation}
                            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                        >
                            Create Group
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
            </div>
        </div>) : null
};

export default GroupCreationForm;