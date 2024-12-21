import React, { useState } from "react";

interface GroupCreationProps {
    isOpen: boolean;
    onClose: () => void
}

const GroupCreationForm = ({ isOpen, onClose }: GroupCreationProps) => {

    const [selectedParticipants, setSelectedParticipants] = useState([]);

    const handleFormSubmit = () => {
        onClose();
    };

    return isOpen ? (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 w-96 max-w-full">
                <h2 className="text-lg font-bold mb-4">Create New Group</h2>
                <div>
                    <label className="block text-sm font-medium mb-2">
                        Select Participants:
                    </label>
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                        Group chats coming soon!!
                    </label>
                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={handleFormSubmit}
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
        </div>
    ) : null;
};

export default GroupCreationForm;