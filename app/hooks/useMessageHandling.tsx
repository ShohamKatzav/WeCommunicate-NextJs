import { useCallback } from 'react';
import { Socket } from 'socket.io-client';
import Message from '@/types/message';
import MessageDTO from '@/types/messageDTO';
import ChatUser from '@/types/chatUser';
import { saveMessage, revalidateChatRoute } from '@/app/lib/chatActions';
import { toast } from "sonner";

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
    setLastReceivedMessage: (message: Message) => void;
    setMessageToPush: (message: Message) => void;
    updateConversationsBar: (message: Message | null, mode?: string, cleanId?: string) => Promise<void>;
}

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
    setLastReceivedMessage,
    setMessageToPush,
    updateConversationsBar
}: UseMessageHandlingProps) => {

    const handleIncomingMessage = useCallback((data: Message) => {
        if (data.sender?.toUpperCase() === userEmail?.toUpperCase()) return;

        if (data.conversationID?.toUpperCase() === currentConversationId.current.toUpperCase()) {
            setChat([...chatRef.current, data].sort((a: Message, b: Message) =>
                new Date(a.date!).getTime() - new Date(b.date!).getTime()
            ));
        }

        setLastReceivedMessage(data as Message);
        updateConversationsBar(data);
    }, [userEmail, currentConversationId, chatRef, setChat, setLastReceivedMessage, updateConversationsBar]);

    const handleServerSavedMessageResponse = useCallback(async (savedMessage: any, tempId: string) => {
        const tempMessage = chatRef.current.find(
            msg => msg._id?.toUpperCase() === tempId.toUpperCase()
        );

        if (!tempMessage) {
            console.warn("Temp message not found:", tempId);
            return;
        }

        const messageDoc = savedMessage.messageDoc || savedMessage;

        setChat(
            chatRef.current.map(msg =>
                msg._id === tempMessage._id ? messageDoc : msg
            )
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

        const finalMessage = {
            ...messageDoc,
            conversationID: currentConversationId.current || newConversationId
        };

        setMessageToPush(tempMessage);
        setLastReceivedMessage(finalMessage);
        updateConversationsBar(finalMessage);
    }, [socket, currentConversationId, chatRef, setChat, setMessageToPush, setLastReceivedMessage, updateConversationsBar]);

    const handleSendMessage = useCallback(async () => {
        const tempId = new Date().getTime().toString();

        if (socket && !loadingSocket && participants.current?.length) {
            const newTempMessage: MessageDTO = {
                _id: tempId,
                date: new Date(),
                sender: messageToSend.sender || "",
                text: messageToSend.text?.trim(),
                file: messageToSend?.file || undefined,
                participantID: messageToSend.participantID || [],
                conversationID: messageToSend.conversationID || ""
            };
            setMessageToSend(prev => ({ ...prev, text: '', file: null }));
            setChat([...chatRef.current, newTempMessage as Message]);

            try {
                const result = await saveMessage(newTempMessage);
                if (result.blocked) {
                    // Remove the temp message
                    setChat(chatRef.current.filter(m => m._id !== tempId));

                    // Determinating message to show base on modereting result and emmiting event
                    let message = '';
                    if (result.punishment.includes("ban")) {
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
            } catch (error) {
                toast.info("Offline right now - I’ll send this message when you’re back online.");
            }
        }
    }, [socket, loadingSocket, participants, messageToSend, chatRef, setChat, setMessageToSend, handleServerSavedMessageResponse]);


    return {
        handleIncomingMessage,
        handleServerSavedMessageResponse,
        handleSendMessage,
    };
};