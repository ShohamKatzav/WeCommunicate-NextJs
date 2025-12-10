import { useEffect, useCallback } from 'react';
import Message from '@/types/message';

interface ServiceWorkerSyncProps {
    handleServerSavedMessageResponse: (savedMessage: any, tempId: string) => Promise<any>;
    setConversationsForBar: (message: Message | null, mode: string, cleanId?: string) => Promise<void>;
}

export const useServiceWorkerSync = ({
    handleServerSavedMessageResponse,
    setConversationsForBar,
}: ServiceWorkerSyncProps) => {


    const swListener = useCallback(async (event: any) => {
        if (!event.data) return;
        if (event.data.type === 'CONVERSATION_DELETED_QUEUED') {

            await setConversationsForBar(null, "Delete", event.data.id);
            return;
        }
        if (event.data.type === 'MESSAGE_SYNCED') {
            const { savedMessage, tempId } = event.data;
            await handleServerSavedMessageResponse(savedMessage, tempId);
        }
    }, [handleServerSavedMessageResponse, setConversationsForBar]);

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', swListener);

            return () =>
                navigator.serviceWorker.removeEventListener('message', swListener);
        }
    }, [swListener]);
};