"use server"
import { env } from '@/app/config/env';
import { MAX_MESSAGE_LENGTH, ALL_MESSAGE_REACTIONS } from '@/app/config/limits';
import connectDB from "@/app/lib/MongoDb";
import mongoose, { Types } from "mongoose";
import ModerationService from '@/services/ModerationService';
import AccountRepository from "@/repositories/AccountRepository";
import MessageRepository from "@/repositories/MessageRepository";
import ConversationRepository from "@/repositories/ConversationRepository";
import CleanHistoryRepository from "@/repositories/CleanHistoryRepository";
import { extractUserIDFromCoockie, extractUsersEmailFromCoockie } from '@/app/lib/cookieActions';
import { IAccount } from "@/models/Account";
import MessageDTO from "@/types/messageDTO";
import { revalidatePath } from 'next/cache';
import RedisService from '@/services/RedisService';
import { sendNotification } from '@/app/lib/pushActions';
import { isTestBypass } from '@/app/lib/testBypass';
import { getT } from '@/app/i18n/server';
import type { TFunction } from '@/app/i18n/messages';
import en from '@/app/i18n/en';

type Moderation = Awaited<ReturnType<typeof ModerationService.moderateMessage>>;
type Punishment = Awaited<ReturnType<typeof ModerationService.recordViolation>>;

// The moderation outcome in the sender's language. The English reason the
// service builds is what's stored on the account; this is the same
// information, worded for the toast.
function moderationReason(t: TFunction, moderation: Moderation) {
    if (!moderation.topCategories?.length) return t('moderation.inappropriate');
    const labels = moderation.topCategories.map(({ category, score }) => {
        const label = category in en.moderation.categories
            ? t(`moderation.categories.${category as keyof typeof en.moderation.categories}`)
            : category;
        return `${label} (${(score * 100).toFixed(1)}%)`;
    });
    return t('moderation.flaggedFor', { categories: labels.join(', ') });
}

function punishmentMessage(t: TFunction, punishment: Punishment, reason: string) {
    switch (punishment.action) {
        case 'warning':
            return t('moderation.warning', { count: punishment.warningCount, max: punishment.maxWarnings, reason });
        case 'temp_ban':
            return t('moderation.tempBan', {
                count: punishment.banDurationHours ?? 0,
                date: punishment.bannedUntil?.toLocaleString(t.dateLocale, { hour12: false }) ?? '',
            });
        case 'permanent_ban':
            return punishment.repeated ? t('moderation.permanentBanRepeated') : t('moderation.permanentBan', { reason });
    }
}

// Push notifications are sent from here (server-side, right after a message
// is persisted) rather than from the sender's browser - a push triggered
// client-side never fires if the sender closes the tab right after sending.
// "Offline" means the participant currently has no connected socket at all.
async function notifyOfflineParticipants(message: MessageDTO, messageDoc: any) {
    try {
        const participantIds = message.participantID || [];
        if (participantIds.length === 0) return;

        const participants = await AccountRepository.getUsersByID(participantIds);
        const offlineParticipantIds: string[] = [];
        for (const participant of participants) {
            const sockets = await RedisService.getUserSocketsByEmail(participant.email);
            if (sockets.length === 0) {
                offlineParticipantIds.push(participant._id.toString());
            }
        }

        if (offlineParticipantIds.length === 0) return;

        await sendNotification({
            ...message,
            sender: messageDoc.sender,
            conversationID: messageDoc.conversation?.toString(),
            participantID: offlineParticipantIds,
        });
    } catch (err) {
        console.error('Failed to send push notification:', err);
    }
}

// A pin arrives as whatever the client put on the payload, so it's narrowed
// to two finite numbers in range here rather than handed to Mongoose as-is -
// the schema's own min/max is the last line of defence, not the first.
function isValidLocation(location: MessageDTO['location']) {
    if (!location) return false;
    const { latitude, longitude } = location;
    return Number.isFinite(latitude) && Number.isFinite(longitude)
        && latitude >= -90 && latitude <= 90
        && longitude >= -180 && longitude <= 180;
}

export const getMessages = async (participantsId: string[], page: number) => {
    if (typeof page !== 'number' || page < 1) {
        return {
            success: false,
            message: 'Invalid page number',
            chat: [],
            conversation: null
        };
    }
    if (!Array.isArray(participantsId) || participantsId.some((id: string) => typeof id !== "string")) {
        return {
            success: false,
            message: 'Invalid participantsId',
            chat: [],
            conversation: null
        };
    }
    const messagesPerPage: number = env.NEXT_PUBLIC_MESSAGES_PER_PAGE;
    try {
        await connectDB();
        let chatQuery: any;
        let chat: any = [];
        let totalMessagesCount = 0;

        const userID = await extractUserIDFromCoockie();
        const partners = await AccountRepository.getUsersByID(participantsId);

        if (!userID || !partners) {
            return {
                success: false,
                message: 'Invalid participantsId',
                chat: [],
                conversation: null
            };
        }

        // Check for existing conversation between the users
        const conversation = await ConversationRepository.GetConversationByMembers([
            Types.ObjectId.createFromHexString(userID),
            ...partners.map((partner: IAccount) => new mongoose.Types.ObjectId(partner._id.toString()))
        ]);

        // If no conversation exists, return an empty response
        if (!conversation) {
            return {
                success: false,
                message: 'No conversation exists between the users',
                chat: [],
                conversation: null
            };
        }

        chatQuery = { conversation: conversation._id };

        if (conversation) {
            const cleanHistoryTime = await CleanHistoryRepository.findCleanHistory(
                Types.ObjectId.createFromHexString(userID),
                conversation._id
            );
            if (cleanHistoryTime) {
                chatQuery.date = { $gt: cleanHistoryTime.date }; // Filter messages after clean history time
            }
            totalMessagesCount = await MessageRepository.countMessages(chatQuery);
        }

        const skipCount: number = messagesPerPage * page;

        if (totalMessagesCount < skipCount) {
            if (skipCount - messagesPerPage < totalMessagesCount)
                chat = await MessageRepository.GetMessages(chatQuery, totalMessagesCount % messagesPerPage, 0);
            const result = JSON.parse(JSON.stringify({ success: true, message: 'All data fetched', chat, conversation: conversation._id }))
            return result;
        }

        chat = await MessageRepository.GetMessages(chatQuery, messagesPerPage, totalMessagesCount - messagesPerPage * page);
        const result = JSON.parse(JSON.stringify({ success: true, message: 'success', chat, conversation: conversation._id }))
        return result;

    } catch (err) {
        return {
            success: false,
            message: 'Failed to retrieve messages',
            chat: [],
            conversation: null
        };
    }
}

export const saveMessage = async (message: MessageDTO) => {
    const t = await getT();
    try {
        await connectDB();
        const userID = await extractUserIDFromCoockie();
        if (typeof userID !== 'string') {
            throw new Error('Unauthorized');
        }

        // The sender is always the authenticated caller, never whatever the
        // client claims - otherwise a user could persist a message under a
        // spoofed sender email even though the conversation membership is
        // correctly scoped to their own account.
        const senderEmail = await AccountRepository.getEmailById(new Types.ObjectId(userID));
        if (!senderEmail) {
            throw new Error('Unauthorized');
        }
        message = { ...message, sender: senderEmail };

        if (message.location !== undefined && message.location !== null) {
            if (!isValidLocation(message.location)) {
                return JSON.parse(JSON.stringify({
                    success: false,
                    blocked: true,
                    message: t('errors.locationNotShared')
                }));
            }
            message = {
                ...message,
                location: {
                    latitude: message.location.latitude,
                    longitude: message.location.longitude
                }
            };
        }

        // Enforced here as well as on the inputs, because a server action is a
        // public endpoint - the client-side maxLength is a convenience, not a
        // limit.
        if (message.text && message.text.length > MAX_MESSAGE_LENGTH) {
            return JSON.parse(JSON.stringify({
                success: false,
                blocked: true,
                tooLong: true,
                message: t('errors.messageTooLong', { max: MAX_MESSAGE_LENGTH })
            }));
        }

        if (!(await isTestBypass())) {
            // saveMessage was previously an unthrottled server action - 30
            // messages per minute is generous for real chat use but stops
            // flooding a conversation or hammering the DB/moderation API.
            const allowedToSend = await RedisService.checkRateLimit('send-message', userID, 30, 60);
            if (!allowedToSend) {
                return JSON.parse(JSON.stringify({
                    success: false,
                    blocked: true,
                    rateLimited: true,
                    message: t('errors.sendingTooFast')
                }));
            }
        }

        // Scoped to 1:1 conversations only - group-chat blocking would mean
        // silently dropping a message for just one recipient while everyone
        // else in the group sees it, which is its own can of worms and out
        // of scope here. A neutral rejection, not "you're blocked" - telling
        // a blocked sender exactly why can escalate exactly the harassment
        // this feature exists to stop.
        if (message.participantID?.length === 1) {
            const isBlocked = await AccountRepository.isBlockedEitherWay(userID, message.participantID[0]);
            if (isBlocked) {
                return JSON.parse(JSON.stringify({
                    success: false,
                    blocked: true,
                    message: t('errors.notDelivered')
                }));
            }
        }

        const banStatus = await ModerationService.isUserBanned(userID);
        if (banStatus.isBanned) {
            return JSON.parse(JSON.stringify({
                success: false,
                blocked: true,
                banned: true,
                reason: banStatus.reason,
                bannedUntil: banStatus.bannedUntil,
                message: banStatus.bannedUntil
                    ? t('errors.bannedUntil', { date: banStatus.bannedUntil.toLocaleString(t.dateLocale, { hour12: false }) })
                    : t('errors.bannedPermanently')
            }));
        }
        if (message.text) {
            const moderation = await ModerationService.moderateMessage(message.text);

            if (!moderation.isAllowed) {
                // Record violation and apply punishment
                const punishment = await ModerationService.recordViolation(
                    userID,
                    message.text,
                    moderation.reason || 'Inappropriate content',
                    moderation.categories || [],
                    moderation.severity || 'medium'
                );
                const reason = moderationReason(t, moderation);

                return JSON.parse(JSON.stringify({
                    success: false,
                    blocked: true,
                    punishment: punishment.action,
                    warningCount: punishment.warningCount,
                    bannedUntil: punishment.bannedUntil,
                    reason,
                    message: punishmentMessage(t, punishment, reason)
                }));
            }
        }

        const messageDoc = await MessageRepository.SaveMessage(message, userID);

        // Fire-and-forget: don't make the sender wait on push delivery.
        void notifyOfflineParticipants(message, messageDoc);

        const result = JSON.parse(JSON.stringify({ success: true, messageDoc }));
        if (result) {
            revalidatePath('/chat');
            return result;
        }
    } catch (err) {
        console.error('Failed to save message:', err);
        const result = JSON.parse(JSON.stringify({ success: false, message: t('errors.saveFailed') }))
        return result;
    }
}

export const deleteMessage = async (id: string, type: string = "message") => {
    const t = await getT();
    try {
        await connectDB();
        const userID = await extractUserIDFromCoockie();
        if (typeof userID !== 'string') {
            throw new Error('Unauthorized');
        }
        // Ownership is checked against the verified account's email, same
        // identity saveMessage stamps as the sender.
        const requesterEmail = await AccountRepository.getEmailById(new Types.ObjectId(userID));
        if (!requesterEmail) {
            throw new Error('Unauthorized');
        }
        const result = await MessageRepository.deleteMessage(id, requesterEmail);
        if (result) {
            revalidatePath('/chat');
            return { success: true, message: "Message deleted" };
        }
        else
            return { success: false, message: t('errors.deleteFailed') };
    } catch (err) {
        console.error('Failed to delete message:', err);
        const result = { success: false, message: t('errors.deleteFailed') };
        return result;
    }
}

// Replaces the text of one of the caller's own messages in place. New text is
// new content, so it goes through the same checks a send does (length, block,
// ban, moderation). The message keeps its original date; `edited` marks it.
export const editMessage = async (id: string, text: string) => {
    const t = await getT();
    try {
        if (typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
            return { success: false, message: t('errors.invalidMessage') };
        }
        const newText = typeof text === 'string' ? text.trim() : '';
        if (!newText) {
            return { success: false, message: t('errors.emptyMessage') };
        }
        if (newText.length > MAX_MESSAGE_LENGTH) {
            return { success: false, tooLong: true, message: t('errors.messageTooLong', { max: MAX_MESSAGE_LENGTH }) };
        }

        await connectDB();
        const userID = await extractUserIDFromCoockie();
        if (typeof userID !== 'string') {
            return { success: false, message: t('errors.unauthorized') };
        }
        // Ownership is checked against the verified account's identity, the
        // same one saveMessage stamps as the sender - a phone:+... key for a
        // phone-only account, which is just as valid here as an email.
        const requesterEmail = await AccountRepository.getEmailById(new Types.ObjectId(userID));
        if (!requesterEmail) {
            return { success: false, message: t('errors.unauthorized') };
        }

        if (!(await isTestBypass())) {
            // Every edit is a moderation call and a write, same as a send.
            const allowed = await RedisService.checkRateLimit('edit-message', userID, 30, 60);
            if (!allowed) {
                return { success: false, rateLimited: true, message: t('errors.editingTooFast') };
            }
        }

        const original = await MessageRepository.GetEditableMessage(id, requesterEmail);
        if (!original) {
            return { success: false, message: t('errors.cantEdit') };
        }

        // Nothing changed - don't mark it edited or spend a moderation call.
        if (original.text === newText) {
            return { success: true, messageId: id, conversationId: original.conversation.toString(), text: newText, unchanged: true };
        }

        // Same 1:1-only scope and neutral wording as saveMessage's check:
        // editing an old message is still putting new text in front of
        // someone who blocked you.
        const conversation = await ConversationRepository.GetConversationById(original.conversation.toString());
        const members: { _id: Types.ObjectId }[] = conversation?.members || [];
        if (members.length === 2) {
            const other = members.find(member => member._id.toString() !== userID);
            if (other && await AccountRepository.isBlockedEitherWay(userID, other._id.toString())) {
                return { success: false, blocked: true, message: t('errors.editBlocked') };
            }
        }

        const banStatus = await ModerationService.isUserBanned(userID);
        if (banStatus.isBanned) {
            return JSON.parse(JSON.stringify({
                success: false,
                blocked: true,
                banned: true,
                reason: banStatus.reason,
                bannedUntil: banStatus.bannedUntil,
                message: banStatus.bannedUntil
                    ? t('errors.bannedUntil', { date: banStatus.bannedUntil.toLocaleString(t.dateLocale, { hour12: false }) })
                    : t('errors.bannedPermanently')
            }));
        }

        const moderation = await ModerationService.moderateMessage(newText);
        if (!moderation.isAllowed) {
            const punishment = await ModerationService.recordViolation(
                userID,
                newText,
                moderation.reason || 'Inappropriate content',
                moderation.categories || [],
                moderation.severity || 'medium'
            );
            const reason = moderationReason(t, moderation);

            return JSON.parse(JSON.stringify({
                success: false,
                blocked: true,
                punishment: punishment.action,
                warningCount: punishment.warningCount,
                bannedUntil: punishment.bannedUntil,
                reason,
                message: punishmentMessage(t, punishment, reason)
            }));
        }

        const result = await MessageRepository.editMessage(original, newText);
        if (!result) {
            return { success: false, message: t('errors.cantEdit') };
        }

        revalidatePath('/chat');
        return { success: true, ...result };
    } catch (err) {
        console.error('Failed to edit message:', err);
        return { success: false, message: t('errors.editFailed') };
    }
}

// Adds the caller's reaction to a message, or removes it when they pick the
// one they already have. Never revalidates /chat: reactions reach everyone
// else over the socket (see 'react to message' in socket/handlers.ts), and a
// full route revalidation per tap would be wildly out of proportion.
export const toggleMessageReaction = async (messageId: string, emoji: string) => {
    const t = await getT();
    try {
        if (typeof messageId !== 'string' || !Types.ObjectId.isValid(messageId)) {
            return { success: false, message: t('errors.invalidMessage') };
        }
        if (typeof emoji !== 'string' || !ALL_MESSAGE_REACTIONS.includes(emoji)) {
            return { success: false, message: t('errors.unsupportedReaction') };
        }

        await connectDB();
        const userID = await extractUserIDFromCoockie();
        if (typeof userID !== 'string') {
            return { success: false, message: t('errors.unauthorized') };
        }

        if (!(await isTestBypass())) {
            // A reaction is one tap, so the ceiling is higher than sending -
            // but it's still a write per tap, and holding a key down on the
            // picker shouldn't be able to hammer the DB.
            const allowed = await RedisService.checkRateLimit('react-message', userID, 60, 60);
            if (!allowed) {
                return { success: false, rateLimited: true, message: t('errors.reactingTooFast') };
            }
        }

        const senderEmail = await AccountRepository.getEmailById(new Types.ObjectId(userID));
        if (!senderEmail) {
            return { success: false, message: t('errors.unauthorized') };
        }

        const result = await MessageRepository.ToggleReaction(
            messageId,
            senderEmail,
            emoji,
            Types.ObjectId.createFromHexString(userID)
        );
        if (!result) {
            return { success: false, message: t('errors.messageGone') };
        }

        return JSON.parse(JSON.stringify({ success: true, ...result }));
    } catch (err) {
        console.error('Failed to toggle reaction:', err);
        return { success: false, message: t('errors.reactionFailed') };
    }
}

export const searchMessages = async (searchTerm: string) => {
    const trimmedTerm = typeof searchTerm === 'string' ? searchTerm.trim() : '';
    if (!trimmedTerm) {
        return { success: true, results: [] };
    }
    try {
        await connectDB();
        const userID = await extractUserIDFromCoockie();
        if (typeof userID !== 'string') {
            return { success: false, results: [] };
        }

        if (!(await isTestBypass())) {
            // Search runs a $text scan across every conversation the user is
            // in on each call - cheap per call, but still worth capping so a
            // client can't hammer it on every keystroke.
            const allowedToSearch = await RedisService.checkRateLimit('search-messages', userID, 30, 60);
            if (!allowedToSearch) {
                return { success: false, results: [], rateLimited: true, message: (await getT())('errors.searchingTooFast') };
            }
        }

        const results = await MessageRepository.SearchMessages(Types.ObjectId.createFromHexString(userID), trimmedTerm);
        return JSON.parse(JSON.stringify({ success: true, results }));
    } catch (err) {
        console.error('Failed to search messages:', err);
        return { success: false, results: [] };
    }
}

export const getConversationMembers = async (conversationId: string) => {
    try {
        await connectDB();
        const requesterEmail = await extractUsersEmailFromCoockie();
        if (!requesterEmail) {
            return { success: false, members: [] };
        }
        const conversation = await ConversationRepository.GetConversationById(conversationId);
        if (!conversation) {
            return { success: false, members: [] };
        }
        // Only members of the conversation may see who else is in it -
        // conversation IDs are otherwise guessable/discoverable, and this
        // would leak the member list of any conversation to anyone logged in.
        const isRequesterMember = conversation.members?.some(
            (member: any) => member.email?.toLowerCase() === requesterEmail.toLowerCase()
        );
        if (!isRequesterMember) {
            return { success: false, members: [] };
        }
        const result = JSON.parse(JSON.stringify({
            success: true,
            members: conversation.members
        }));
        return result;
    } catch (err) {
        console.error('Failed to get conversation members:', err);
        return { success: false, members: [] };
    }
}

export const revalidateChatRoute = async () => {
    revalidatePath('/chat');
    return { success: true };
}

