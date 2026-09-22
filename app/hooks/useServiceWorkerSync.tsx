import { useEffect, useCallback } from 'react';
import Message from '@/types/message';

interface ServiceWorkerSyncProps {
    handleServerSavedMessageResponse: (savedMessage: any, tempId: string) => Promise<any>;
    setConversationsForBar: (message: Message | null, mode: string, cleanId?: string) => Promise<void>;
    onCleanHistorySynced: (conversationId: string) => void;
    onCleanHistoryRejected: (conversationId: string) => void;
}

export const useServiceWorkerSync = ({
    handleServerSavedMessageResponse,
    setConversationsForBar,
    onCleanHistorySynced,
    onCleanHistoryRejected,
}: ServiceWorkerSyncProps) => {


    const swListener = useCallback(async (event: any) => {
        if (!event.data) return;
        if (event.data.type === 'MESSAGE_SYNCED') {
            const { savedMessage, tempId } = event.data;
            await handleServerSavedMessageResponse(savedMessage, tempId);
            return;
        }
        if (event.data.type === 'CLEAN_HISTORY_SYNCED') {
            onCleanHistorySynced(event.data.conversationId);
            return;
        }
        if (event.data.type === 'CLEAN_HISTORY_REJECTED') {
            onCleanHistoryRejected(event.data.conversationId);
            return;
        }
    }, [handleServerSavedMessageResponse, setConversationsForBar, onCleanHistorySynced, onCleanHistoryRejected]);

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', swListener);

            return () =>
                navigator.serviceWorker.removeEventListener('message', swListener);
        }
    }, [swListener]);
};