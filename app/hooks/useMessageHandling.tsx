import { useCallback } from 'react';
import { Socket } from 'socket.io-client';
import Message from '@/types/message';
import MessageDTO from '@/types/messageDTO';
import ChatUser from '@/types/chatUser';
import FileDTO from '@/types/FileDTO';
import MessageLocation from '@/types/messageLocation';
import { saveMessage, revalidateChatRoute } from '@/app/lib/chatActions';
import { toast } from "sonner";
import { PendingClears } from './usePendingCleanHistory';

interface UseMessageHandlingProps {
    socket: Socket | null;
    loadingSocket: boolean;
    userEmail?: string;
    currentConversationId: React.RefObject<string>;
    participants: React.RefObject<ChatUser[] | null>;
    chatRef: React.RefObject<Message[]>;
    setChat: (messages: Message[]) => void;
    messageToSend: Message;
    setMessageToSend: React.Dispatch<React.SetStateAction<Message>>;
    updateConversationsBar: (message: Message | null, mode?: string, cleanId?: string) => Promise<void>;
    pendingClearsRef: React.RefObject<PendingClears>;
}

const isAtOrBeforeCutoff = (dateValue: Date | string | undefined, cutoff: string | undefined): boolean => {
    if (!cutoff || !dateValue) return false;
    return new Date(dateValue).getTime() <= new Date(cutoff).getTime();
};

const warningsBeforeBan = 3;

export const useMessageHandling = ({
    socket,
    loadingSocket,
    userEmail,
    currentConversationId,
    participants,
    chatRef,
    setChat,
    messageToSend,
    setMessageToSend,
    updateConversationsBar,
    pendingClearsRef
}: UseMessageHandlingProps) => {

    const handleIncomingMessage = useCallback((data: Message) => {
        if (data.sender?.toUpperCase() === userEmail?.toUpperCase()) return;

        // Predates a clear this device applied offline but hasn't synced yet
        // - must not reappear in the transcript or bump the bar, same as a
        // synced message would be dropped by handleServerSavedMessageResponse.
        const cutoff = data.conversationID ? pendingClearsRef.current[data.conversationID] : undefined;
        if (isAtOrBeforeCutoff(data.date, cutoff)) return;

        if (data.conversationID?.toUpperCase() === currentConversationId.current.toUpperCase()) {
            setChat([...chatRef.current, data].sort((a: Message, b: Message) =>
                new Date(a.date!).getTime() - new Date(b.date!).getTime()
            ));
            // The conversation this message belongs to is already open, so
            // it's effectively read the moment it arrives - tell the sender.
            socket?.emit('message read', { conversationId: data.conversationID });
        }

        updateConversationsBar(data);
    }, [userEmail, currentConversationId, chatRef, setChat, updateConversationsBar, socket, pendingClearsRef]);

    const handleServerSavedMessageResponse = useCallback(async (savedMessage: any, tempId: string) => {
        const tempMessage = chatRef.current.find(
            msg => msg._id?.toUpperCase() === tempId.toUpperCase()
        );

        if (!tempMessage) {
            console.warn("Temp message not found:", tempId);
            return;
        }

        const messageDoc = savedMessage.messageDoc || savedMessage;

        // A message that was queued before a clear this device applied
        // offline (its date now resolves to at or before that cutoff) is
        // still a real, delivered message - it's still published to the
        // other participant below - but it must not resurface in our own
        // transcript or bar, since it predates a clear we made on this device.
        const cutoffConversationId = messageDoc.conversation || currentConversationId.current;
        const cutoff = cutoffConversationId ? pendingClearsRef.current[cutoffConversationId] : undefined;
        const isClearedByPending = isAtOrBeforeCutoff(messageDoc.date, cutoff);

        setChat(
            isClearedByPending
                ? chatRef.current.filter(msg => msg._id !== tempMessage._id)
                : chatRef.current.map(msg => msg._id === tempMessage._id ? messageDoc : msg)
        );

        tempMessage._id = messageDoc._id;
        let newConversationId;

        if (!currentConversationId.current) {
            newConversationId = messageDoc?.conversation;
            currentConversationId.current = newConversationId;
            socket?.emit('join room', { conversationId: newConversationId });
            await revalidateChatRoute();
        }

        const messageToEmit = {
            ...messageDoc,
            conversationID: messageDoc.conversation || currentConversationId.current
        };

        socket?.emit('publish message', messageToEmit);

        if (!isClearedByPending) {
            const finalMessage = {
                ...messageDoc,
                conversationID: currentConversationId.current || newConversationId
            };

            updateConversationsBar(finalMessage);
        }
    }, [socket, currentConversationId, chatRef, setChat, updateConversationsBar, pendingClearsRef]);

    // `overrideFile` lets a caller send a file that was only just produced
    // (e.g. voiceRecorder.tsx, right after its upload finishes) without
    // waiting on a setMessageToSend->re-render round trip first - reading it
    // back off `messageToSend` immediately after setting it would still see
    // the stale pre-update closure value, since this callback's identity
    // only refreshes on the next render.
    // `overrideLocation` follows the same pattern for a pin shared straight
    // from the composer (see shareLocationButton.tsx) - it's never staged as
    // a draft the way text and attachments are, so it can't be read back off
    // `messageToSend` either.
    const handleSendMessage = useCallback(async (overrideFile?: FileDTO, overrideLocation?: MessageLocation) => {
        // A random id, not a timestamp - two sends in the same millisecond
        // (or a burst of offline-queued sends flushing together) used to
        // produce colliding temp ids, which handleServerSavedMessageResponse
        // matches by. (See public/service-worker.js's isMongoObjectId check,
        // which this must stay a non-ObjectId string to work with.)
        const tempId = crypto.randomUUID();

        if (socket && !loadingSocket && participants.current?.length) {
            const newTempMessage: MessageDTO = {
                _id: tempId,
                date: new Date(),
                sender: messageToSend.sender || "",
                text: messageToSend.text?.trim(),
                file: overrideFile || messageToSend?.file || undefined,
                location: overrideLocation,
                participantID: messageToSend.participantID || [],
                conversationID: messageToSend.conversationID || "",
                replyTo: messageToSend.replyTo
            };
            setMessageToSend(prev => ({ ...prev, text: '', file: null, replyTo: undefined }));
            setChat([...chatRef.current, newTempMessage as Message]);

            try {
                const result = await saveMessage(newTempMessage);
                if (result.blocked) {
                    // Remove the temp message
                    setChat(chatRef.current.filter(m => m._id !== tempId));

                    if (result.banned) {
                        // Already banned before this message was even evaluated -
                        // this response shape has no `punishment` field, only
                        // `banned`/`message`/`bannedUntil`/`reason`.
                        toast.error(result.message || 'Your account is banned from sending messages.', { duration: 10000 });
                        return;
                    }

                    if (result.rateLimited) {
                        toast.warning(result.message || "You're sending messages too quickly. Please slow down.");
                        return;
                    }

                    if (result.tooLong) {
                        toast.warning(result.message || 'That message is too long to send.');
                        return;
                    }

                    if (!result.punishment) {
                        // A block with no moderation punishment attached -
                        // e.g. blocked user-to-user messaging (see
                        // chatActions.saveMessage's isBlockedEitherWay
                        // check). Without this, the temp message above was
                        // already removed from chat with no toast at all,
                        // so it would just silently vanish.
                        toast.error(result.message || "Couldn't send that message.");
                        return;
                    }

                    // Determinating message to show base on modereting result and emmiting event
                    let message = '';
                    if (result.punishment?.includes("ban")) {
                        if (result.bannedUntil) {
                            message = `You've been temporarily banned until ${new Date(result.bannedUntil).toLocaleString()}. Reason: ${result.reason}`;
                        } else {
                            message = `You've been permanently banned. Reason: ${result.reason}`;
                        }
                        socket.emit('ban user', { userEmail: messageToSend.sender, message: message });
                    } else if (result.punishment === 'warning') {
                        toast.warning(
                            `Warning ${result.warningCount}/${warningsBeforeBan}: ${result.reason}`,
                            { duration: 7000 }
                        );
                    }
                    return;
                }
                await handleServerSavedMessageResponse(result, tempId);
            } catch (error: any) {
                // Distinguish a genuine network/offline failure (which the
                // service worker queues for retry) from an actual bug or
                // server error (which was NOT queued) - the previous blanket
                // catch reported every failure as "you're offline", even
                // when the message was silently lost instead.
                const isOffline = (typeof navigator !== 'undefined' && !navigator.onLine)
                    || error?.name === 'TypeError'
                    || error?.message?.includes('Failed to fetch');

                if (isOffline) {
                    toast.info("Offline right now - I’ll send this message when you’re back online.");
                } else {
                    console.error('Failed to send message:', error);
                    setChat(chatRef.current.filter(m => m._id !== tempId));
                    toast.error("Something went wrong sending that message. Please try again.");
                }
            }
        }
    }, [socket, loadingSocket, participants, messageToSend, chatRef, setChat, setMessageToSend, handleServerSavedMessageResponse]);


    return {
        handleIncomingMessage,
        handleServerSavedMessageResponse,
        handleSendMessage,
    };
};