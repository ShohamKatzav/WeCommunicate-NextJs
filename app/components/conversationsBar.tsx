"use client"
import { Plus, Search, MessageSquareDiff } from 'lucide-react';
import { useState } from 'react';
import ConversationsList from './conversationsList';
import ChatUser from '@/types/chatUser';
import Conversation from '@/types/conversation';

interface ConversationsBarProps {
    isMobileChatsSidebarOpen: boolean;
    handleOpenModal: (mode: string) => void;
    getLastMessages: (roomParticipants: ChatUser[]) => Promise<void>;
    initialRecentConversations: Conversation[];
}

const ConversationsBar =
    ({ isMobileChatsSidebarOpen,
        handleOpenModal,
        getLastMessages,
        initialRecentConversations }:
        ConversationsBarProps) => {

        const [query, setQuery] = useState('');


        return (
            <div className={`
        ${isMobileChatsSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        xl:translate-x-0 fixed xl:relative z-20
        w-80 xl:w-72 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
        transition-transform duration-300 ease-in-out h-full flex flex-col shadow-xl
      `}>
                <aside className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden transition-transform duration-300`}>
                    <div className="p-4 flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Chats</h3>
                        <button onClick={() => handleOpenModal('single')} aria-label="New conversation" className="p-1 rounded-md bg-green-700 text-white">
                            <Plus size={25} />
                        </button>
                    </div>


                    <div className="px-4 pb-3">
                        <div className="relative">
                            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search..."
                                className="w-full pl-10 pr-3 py-2  bg-gray-100 dark:bg-gray-700
                                flex-1 p-3 rounded-lg focus:outline-none border"
                                aria-label="Search conversations" />
                            <div className="absolute left-3 top-2.5 text-muted-foreground"><Search size={16} /></div>
                        </div>
                    </div>


                    <div className="px-4 divide-y overflow-auto" style={{ maxHeight: 'calc(100vh - 270px)' }}>
                        <button
                            type="button"
                            onClick={() => handleOpenModal('group')}
                            className="w-full flex items-center justify-center gap-2 bg-linear-to-r from-green-700 to-green-800
              hover:from-green-800 hover:to-green-900 text-white py-3 px-4 rounded-xl shadow-md hover:shadow-lg
              transition-all duration-200 font-semibold"
                        >
                            <MessageSquareDiff size={25} />
                            <span>Create Group</span>
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        <ConversationsList
                            getLastMessages={getLastMessages}
                            query={query}
                            initialConversations={initialRecentConversations}
                        />
                    </div>
                </aside>
            </div >
        );
    }


export default ConversationsBar
