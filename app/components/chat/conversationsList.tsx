"use client"
import { useEffect, useState } from "react";
import ChatUser from "@/types/chatUser";
import ConversationSummary from "./conversationSummary";
import Conversation from "@/types/conversation";
import MessageSearchResult from "@/types/messageSearchResult";
import { searchMessages } from "@/app/lib/chatActions";
import { PendingClears } from "@/app/hooks/usePendingCleanHistory";

interface ConversationsListProps {
    getLastMessages: (participantFromList: ChatUser[]) => Promise<void>;
    query: string;
    initialConversations: Conversation[];
    pendingClears: PendingClears;
}

const SEARCH_DEBOUNCE_MS = 350;

const ConversationsList =
    ({ getLastMessages,
        query,
        initialConversations,
        pendingClears }: ConversationsListProps) => {

        // Only the most recently loaded message per conversation is present in
        // initialConversations (see ConversationRepository.GetRecentConversations'
        // default perDocumentLimit), so the local filter below only ever catches
        // matches in that one message. This hits the server for the rest of each
        // conversation's history, scoped to the requesting user server-side.
        const [remoteMatches, setRemoteMatches] = useState<Map<string, MessageSearchResult>>(new Map());

        useEffect(() => {
            const trimmedQuery = query.trim();
            // Leave remoteMatches as-is rather than clearing it here - it's
            // simply ignored below whenever the query is empty, which avoids
            // a setState call directly in the effect body.
            if (!trimmedQuery) return;

            let cancelled = false;
            const timeoutId = setTimeout(async () => {
                const response = await searchMessages(trimmedQuery);
                if (cancelled) return;
                const matches = new Map<string, MessageSearchResult>();
                if (response.success) {
                    for (const result of response.results as MessageSearchResult[]) {
                        matches.set(result.conversationID, result);
                    }
                }
                setRemoteMatches(matches);
            }, SEARCH_DEBOUNCE_MS);

            return () => {
                cancelled = true;
                clearTimeout(timeoutId);
            };
        }, [query]);

        return (
            <>
                {
                    initialConversations?.length < 1 &&
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md border border-gray-300 dark:border-gray-700 flex items-center gap-4 hover:shadow-lg transition-shadow">
                        <p className="text-gray-600 dark:text-gray-400 text-center">No recent conversations available.</p>
                    </div>
                }

                {
                    initialConversations?.length > 0 && (
                        <div className="divide-y divide-gray-200 dark:divide-gray-700 overflow-auto" style={{ maxHeight: 'calc(100vh - 270px)' }}>
                            {initialConversations.map((conversation: any) => {
                                const membersEmailsIncludeQuery = conversation.members?.some((m: any) => m.email?.toUpperCase().includes(query.toUpperCase()) || m.nickname?.toUpperCase().includes(query.toUpperCase()));
                                // The visible last-message line (see ConversationSummary)
                                // is messages[length - 1], not messages[0] - new messages
                                // get appended, not prepended (see
                                // useConversationsManager's updateConversationsBar), so
                                // messages[0] is whatever was current when the page first
                                // loaded and goes stale the moment a new message arrives.
                                const lastMessage = conversation.messages?.[conversation.messages.length - 1];
                                const messageIncludeQuery = lastMessage?.text?.toUpperCase().includes(query.toUpperCase());
                                const rawRemoteMatch = query.trim() ? remoteMatches.get(conversation._id) : undefined;
                                // remoteMatches is fetched independently of the bar
                                // (see its own comment above) and can still hold a
                                // stale hit from at or before a clear this device
                                // applied offline but hasn't synced yet - unlike
                                // the bar-derived lastMessage check above, that
                                // staleness isn't fixed just by conversationsForBar
                                // being filtered elsewhere, so it's filtered again
                                // here.
                                const pendingClearedAt = conversation._id ? pendingClears[conversation._id] : undefined;
                                const remoteMatch = rawRemoteMatch && pendingClearedAt
                                    ? (() => {
                                        const cutoffTime = new Date(pendingClearedAt).getTime();
                                        const matches = rawRemoteMatch.matches.filter(m => new Date(m.date).getTime() > cutoffTime);
                                        return matches.length > 0 ? { ...rawRemoteMatch, matches } : undefined;
                                    })()
                                    : rawRemoteMatch;
                                const show = query.trim() === '' || (membersEmailsIncludeQuery || messageIncludeQuery || !!remoteMatch);
                                if (!show) return null;

                                return (
                                    <ConversationSummary
                                        key={conversation._id}
                                        conversation={conversation}
                                        getLastMessages={getLastMessages}
                                        searchMatch={remoteMatch}
                                    />
                                );
                            })}
                        </div>
                    )
                }
            </>
        );
    };

export default ConversationsList;
