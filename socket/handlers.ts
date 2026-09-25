import type { DefaultEventsMap, Server, Socket } from 'socket.io';
import RedisService from '@/services/RedisService';
import ModerationService from '@/services/ModerationService';
import { GetLocations, SaveLocations } from "@/app/lib/locationActions";
import { isSameSpot, shouldPersistFix, type SavedFix } from "@/app/utils/geolocation";
import Conversation from '@/models/Conversation'
import Message from '@/models/Message'
import Account from '@/models/Account'
import { sendPushToEmails } from '@/services/PushService';
import { MISSED_CALL_OUTCOMES, type CallOutcome } from '@/types/messageCall';
import { translatorFor } from '@/app/i18n/forLocale';

interface SocketData {
    email: string;
    userId: string;
    typingIn?: Set<string>;
    // Whether this tab is on screen, as last reported by the client ('app
    // visibility'). Unknown counts as hidden, so a client that never reports
    // still gets the call push.
    appVisible?: boolean;
}

type AppServer = Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;
type AppSocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;

interface EmailMember {
    email?: string | null;
}

interface LeanAccount {
    _id: { toString(): string };
    email?: string | null;
    blocked?: { toString(): string }[];
    isModerator?: boolean;
    nickname?: string | null;
}

interface LeanMessage {
    _id: { toString(): string };
    conversation: { toString(): string };
    reactions?: { emoji: string; sender: string }[];
}

interface LeanEditedMessage {
    _id: { toString(): string };
    conversation: { toString(): string };
    sender?: string;
    text?: string;
    edited?: boolean;
    status?: string;
}

interface ClientMessage {
    conversationID?: string;
    conversation?: unknown;
    sender?: string;
    _id?: unknown;
}

interface CallSignal {
    callId?: unknown;
    conversationId?: unknown;
    video?: unknown;
    reason?: unknown;
    description?: unknown;
    candidate?: unknown;
    pushEndpoint?: unknown;
}

interface ActiveCall {
    callId: string;
    conversationId: string;
    caller: string;
    callee: string;
    callerSocketId: string;
    calleeSocketId: string | null;
    state: 'ringing' | 'active';
    video: boolean;
    candidates: number;
    descriptions: number;
    calleeWasReachable: boolean;
    callerName: string;
    // An incoming-call push went out, so a call that ends unanswered sends
    // a "missed call" push to replace it.
    pushed: boolean;
    acceptedAt: number | null;
    ringTimer: ReturnType<typeof setTimeout> | null;
    ended: boolean;
}

interface SessionDescription {
    type: 'offer' | 'answer';
    sdp: string;
}

interface IceCandidate {
    candidate: string;
    sdpMid: string | null;
    sdpMLineIndex: number | null;
    usernameFragment?: string;
}

function membersOf(conversation: { members?: unknown }): EmailMember[] {
    return conversation.members as EmailMember[];
}

async function isConversationMember(conversationId: unknown, email?: string) {
    if (!conversationId || !email) return false;
    try {
        const conversation = await Conversation.findById(conversationId as string).populate('members', 'email');
        if (!conversation) return false;
        return membersOf(conversation).some(member => member.email?.toLowerCase() === email.toLowerCase());
    } catch {
        return false;
    }
}

async function isModerator(email?: string) {
    if (!email) return false;
    const account = await Account.findOne({ email }).select('isModerator').lean<LeanAccount | null>();
    return Boolean(account?.isModerator);
}

// Mirrors AccountRepository.isBlockedEitherWay (TypeScript, used by
// chatActions.saveMessage) - duplicated here rather than imported because
// this file works with models directly, not repositories, and the check is
// small. If either side has blocked the other, messaging between them stops.
async function isBlockedEitherWay(emailA?: string | null, emailB?: string | null) {
    if (!emailA || !emailB) return false;
    const [accountA, accountB] = await Promise.all([
        Account.findOne({ email: emailA }).select('_id blocked').lean<LeanAccount | null>(),
        Account.findOne({ email: emailB }).select('_id blocked').lean<LeanAccount | null>()
    ]);
    if (!accountA || !accountB) return false;
    const idA = accountA._id.toString();
    const idB = accountB._id.toString();
    const blockedByA = (accountA.blocked || []).some(id => id.toString() === idB);
    const blockedByB = (accountB.blocked || []).some(id => id.toString() === idA);
    return blockedByA || blockedByB;
}

export default async function handleSocketConnection(io: AppServer, socket: AppSocket) {
    // The authenticated identity comes from authMiddleware, which verifies
    // the JWT - never from client-supplied handshake headers.
    const email = socket.data.email;

    try {
        // Register every listener before the first await below - the client
        // gets its connect ack (and can start emitting) as soon as the auth
        // middleware resolves, which races ahead of this handler if it awaits
        // anything first. A 'join room'/'message read' emitted in that window
        // previously arrived at a socket with no listener yet and was
        // silently dropped - this is what broke read receipts for a client
        // that reaches the chat page and opens a conversation quickly after
        // connecting (e.g. an already-authenticated session).
        socket.on('update connected users', () => {
            handleUpdateConnectedUsers(io);
            // The client sends this right after a block/unblock (see
            // chatClient.tsx's handleToggleBlock) - also the moment a call
            // between a now-blocked pair has to end.
            safely(() => handleCallBlockCheck(io, email));
        });
        socket.on('join room', (body) => handleJoinRoom(body, socket));
        socket.on('message read', (data) => handleMessageRead(io, socket, data));
        socket.on('publish message', (message) => handlePublishMessage(io, socket, message));
        socket.on('delete message', (message) => handleDeleteMessage(io, socket, message));
        socket.on('edit message', (data) => handleEditMessage(io, socket, data));
        socket.on('react to message', (data) => handleReactToMessage(io, socket, data));
        socket.on('notifications update', () => handleNotificationsUpdate(socket, email));
        socket.on("notifications checked", (roomID) => handleNotificationsChecked(roomID, email));
        socket.on('get locations', () => handleGetLocation(io, socket));
        socket.on('save location', (location, ack) => handleSaveLocation(io, socket, location, ack));
        socket.on('leave room', (body) => handleLeaveRoom(body, socket));
        socket.on('ban user', (data) => handleBanUser(io, socket, data));
        socket.on('unban user', (data) => handleUnbanUser(io, socket, data));
        socket.on('moderator status changed', (data) => handleModeratorStatusChanged(io, socket, data).catch(err => console.error('Failed to relay moderator status change:', err)));
        socket.on('account deleted', (ack) => handleAccountDeleted(io, socket, ack).catch(err => console.error('Failed to sign out a deleted account:', err)));
        socket.on('disconnect', () => {
            // A closed tab never sends its own 'stop typing'.
            stopAllTyping(socket);
            handleDisconnect(io, email, socket.id);
        });
        socket.on('start typing', (data) => handleStartTyping(socket, data));
        socket.on('stop typing', (data) => handleStopTyping(socket, data));
        socket.on('call invite', (data) => safely(() => handleCallInvite(io, socket, data)));
        socket.on('call accept', (data) => safely(() => handleCallAccept(io, socket, data)));
        socket.on('call decline', (data) => safely(() => handleCallDecline(io, socket, data)));
        socket.on('call cancel', (data) => safely(() => handleCallCancel(io, socket, data)));
        socket.on('call hangup', (data) => safely(() => handleCallHangup(io, socket, data)));
        socket.on('call signal', (data) => safely(() => handleCallSignal(io, socket, data)));
        socket.on('call sync', () => safely(() => handleCallSync(socket)));
        socket.on('app visibility', (visible) => {
            socket.data.appVisible = visible === true;
        });

        await RedisService.addUserSocket(email, socket.id);
        // Routed through the same per-viewer filtering as every other
        // presence update (see handleUpdateConnectedUsers) - a raw
        // io.emit here would leak a blocker's presence to this newly
        // connected socket even though every other update correctly hides it.
        await handleUpdateConnectedUsers(io);
    }
    catch (error) {
        console.error('Socket connection error:', error);
        socket.disconnect(true);
    }
}

async function handleJoinRoom(body: { conversationId?: unknown } | undefined, socket: AppSocket) {
    const conversationId = body?.conversationId;
    if (!conversationId) return;

    // Only members of the conversation may join its room - otherwise any
    // authenticated client could read/listen in on any conversation whose
    // ID it can guess or discover.
    if (!(await isConversationMember(conversationId, socket.data.email))) return;

    const room = `chat_room_${conversationId}`;
    socket.join(room);

    socket.to(room).emit('request typing status', {
        requestedBy: socket.id
    });
}

// Marks every not-yet-read message from other members as read, and tells
// the room so senders can update their own sent messages' status. In a
// group conversation this fires as soon as ANY other member has read a
// message, not "read by everyone" - a per-member "seen by" list is a
// bigger feature than this first pass covers.
async function handleMessageRead(io: AppServer, socket: AppSocket, data: { conversationId?: unknown } | undefined) {
    const conversationId = data?.conversationId;
    const readerEmail = socket.data.email;
    if (!conversationId || !readerEmail) return;

    if (!(await isConversationMember(conversationId, readerEmail))) return;

    const result = await Message.updateMany(
        {
            conversation: conversationId,
            sender: { $ne: readerEmail },
            status: { $nin: ['read', 'revoked'] }
        },
        { $set: { status: 'read' } }
    );

    if (result.modifiedCount > 0) {
        const room = `chat_room_${conversationId}`;
        io.to(room).emit('messages read', { conversationId, readerEmail });
    }
}

// Presence is broadcast per-viewer, not as one global list to everyone -
// someone who has blocked you shouldn't reveal their online status to you
// (deliberately still one-directional: you blocking them doesn't hide your
// own presence from them, only theirs from you, matching how the message
// block itself already only rejects sends, not visibility of the blocker).
// One query for however many users are online, not one per viewer.
async function handleUpdateConnectedUsers(io: AppServer) {
    const allOnline = await RedisService.getOnlineUsers();
    const sockets = await io.fetchSockets();
    if (sockets.length === 0) return;

    if (allOnline.length === 0) {
        sockets.forEach(s => s.emit('update connected users', allOnline));
        return;
    }

    const onlineEmails = allOnline.map(u => u.email);
    const accounts = await Account.find({ email: { $in: onlineEmails } })
        .select('email blocked')
        .lean<LeanAccount[]>();
    const emailById = new Map<string, string>(
        accounts.flatMap(a => a.email ? [[a._id.toString(), a.email.toLowerCase()] as [string, string]] : [])
    );

    // targetEmail -> set of emails that have blocked them.
    const blockersOf = new Map<string, Set<string>>();
    for (const account of accounts) {
        if (!account.email) continue;
        for (const blockedId of account.blocked || []) {
            const targetEmail = emailById.get(blockedId.toString());
            if (!targetEmail) continue; // the account they blocked isn't online right now
            let blockers = blockersOf.get(targetEmail);
            if (!blockers) {
                blockers = new Set<string>();
                blockersOf.set(targetEmail, blockers);
            }
            blockers.add(account.email.toLowerCase());
        }
    }

    for (const s of sockets) {
        const viewerEmail = s.data.email?.toLowerCase();
        const blockers = viewerEmail ? blockersOf.get(viewerEmail) : undefined;
        const filtered = blockers
            ? allOnline.filter(u => !blockers.has(u.email.toLowerCase()))
            : allOnline;
        s.emit('update connected users', filtered);
    }
}

async function handlePublishMessage(io: AppServer, socket: AppSocket, message: ClientMessage | undefined) {
    if (!message?.conversationID || !message?.sender) return;
    // The sender the message is published as must match the authenticated
    // caller - otherwise a client could spoof messages "from" anyone else.
    if (message.sender.toLowerCase() !== socket.data.email?.toLowerCase()) return;

    const room = `chat_room_${message.conversationID}`;
    const conversation = await Conversation.findById(message.conversationID).populate('members', 'email');
    if (!conversation) return;

    const members = membersOf(conversation);
    const isMember = members.some(
        member => member.email?.toLowerCase() === socket.data.email?.toLowerCase()
    );
    if (!isMember) return;

    // Real-time fan-out is the last line of defence against a client that
    // emits 'publish message' directly instead of going through the
    // saveMessage server action (which already rejects blocked 1:1 sends
    // before they're ever persisted) - defense in depth, not the primary
    // enforcement point. 1:1 only, same scope as saveMessage's own check.
    if (members.length === 2) {
        const otherMember = members.find(
            member => member.email?.toLowerCase() !== socket.data.email?.toLowerCase()
        );
        if (otherMember && await isBlockedEitherWay(message.sender, otherMember.email)) {
            return;
        }
    }

    for (const member of members) {
        // A member whose email was removed from the account can't be routed
        // by the email-keyed socket registry. Skip them instead of throwing,
        // so everyone else in the conversation still receives the message.
        if (!member.email) continue;
        if (member.email.toUpperCase() === message.sender.toUpperCase()) continue;

        const memberSocketIds = await RedisService.getUserSocketsByEmail(member.email);
        const roomSockets = await io.in(room).allSockets();
        const isAnySocketInRoom = memberSocketIds?.some(id => roomSockets.has(id));

        if (isAnySocketInRoom) {
            memberSocketIds.forEach(id => {
                socket.to(id).emit('publish message', message);
            });
        } else {
            await RedisService.incrNotification(member.email, message.conversationID, 1);
            const notifications = await RedisService.getNotifications(member.email);
            memberSocketIds.forEach(id => {
                socket.to(id).emit('publish message', message);
                socket.to(id).emit('notifications update', notifications);
            });
        }
    }
}

async function handleDeleteMessage(io: AppServer, socket: AppSocket, message: ClientMessage | undefined) {
    // The client's own stored copy of a message it just sent carries
    // `conversation` (the raw Mongoose field name, from the saveMessage
    // response) rather than `conversationID` (the client Message type) -
    // handlePublishMessage's payload corrects this before emitting, but
    // 'delete message' sends the bubble's own message object as-is. Fall
    // back to `conversation` the same way useMessageHandling.tsx already
    // does when building the publish payload.
    const conversationId = message?.conversationID || message?.conversation;
    if (!conversationId || !message?._id) return;

    // Only the message's actual sender may broadcast its deletion -
    // otherwise any client could make any message vanish for everyone.
    const messageDoc = await Message.findById(message._id as string).select('sender');
    if (!messageDoc || messageDoc.sender?.toLowerCase() !== socket.data.email?.toLowerCase()) return;

    const room = `chat_room_${conversationId}`;
    io.to(room).emit('delete message', message);

    const conversation = await Conversation.findById(conversationId as string).populate('members', 'email');
    if (conversation) {
        for (const member of membersOf(conversation)) {
            const memberSocketIds = await RedisService.getUserSocketsByEmail(member.email ?? '');
            const roomSockets = await io.in(room).allSockets();
            const isAnySocketInRoom = memberSocketIds?.some(id => roomSockets.has(id));
            if (!isAnySocketInRoom) {
                memberSocketIds.forEach(id => {
                    io.to(id).emit('delete message', message);
                });
            }
        }
    }
}

// The edit itself was already persisted by the editMessage server action
// before this fires - this only fans it out, to the room and to members who
// don't have the conversation open, the same way a delete is. What goes out
// is re-read from the document rather than taken from the client, so a client
// can't announce text that was never stored (or that moderation rejected).
async function handleEditMessage(io: AppServer, socket: AppSocket, data: { messageId?: unknown } | undefined) {
    const messageId = data?.messageId;
    if (typeof messageId !== 'string' || !OBJECT_ID_PATTERN.test(messageId)) return;

    const messageDoc = await Message.findById(messageId).select('sender text edited status conversation').lean<LeanEditedMessage | null>();
    if (!messageDoc || !messageDoc.edited || messageDoc.status === 'revoked' || !messageDoc.text) return;
    // Only the sender may broadcast an edit of their own message.
    if (messageDoc.sender?.toLowerCase() !== socket.data.email?.toLowerCase()) return;

    const conversationId = messageDoc.conversation.toString();
    const payload = {
        _id: messageDoc._id.toString(),
        conversationID: conversationId,
        text: messageDoc.text,
        edited: true
    };

    const room = `chat_room_${conversationId}`;
    io.to(room).emit('edit message', payload);

    const conversation = await Conversation.findById(conversationId).populate('members', 'email');
    if (conversation) {
        const roomSockets = await io.in(room).allSockets();
        for (const member of membersOf(conversation)) {
            if (!member.email) continue;
            const memberSocketIds = await RedisService.getUserSocketsByEmail(member.email);
            const isAnySocketInRoom = memberSocketIds?.some(id => roomSockets.has(id));
            if (!isAnySocketInRoom) {
                memberSocketIds.forEach(id => {
                    io.to(id).emit('edit message', payload);
                });
            }
        }
    }
}

// The reaction itself was already persisted by the toggleMessageReaction
// server action before this fires - this only fans the change out to whoever
// has the conversation open. The reactions broadcast are re-read from the
// document rather than taken from the client payload, so a client can't
// announce reactions that were never stored.
async function handleReactToMessage(io: AppServer, socket: AppSocket, data: { messageId?: unknown } | undefined) {
    const messageId = data?.messageId;
    if (!messageId) return;

    const message = await Message.findById(messageId as string).select('conversation reactions').lean<LeanMessage | null>();
    if (!message) return;

    const conversationId = message.conversation.toString();
    if (!(await isConversationMember(conversationId, socket.data.email))) return;

    io.to(`chat_room_${conversationId}`).emit('message reactions', {
        messageId: message._id.toString(),
        conversationId,
        reactions: message.reactions || []
    });
}

// The conversations this socket has said it's typing in and not yet stopped.
// Tracked so a tab that closes (or leaves the room) mid-sentence gets its
// 'stop typing' sent for it - before, only the sender's own idle timer ever
// sent one, so a closed tab left "X is typing..." on screen for good.
function typingConversations(socket: AppSocket) {
    if (!socket.data.typingIn) socket.data.typingIn = new Set();
    return socket.data.typingIn;
}

function handleStartTyping(socket: AppSocket, data: { conversationId?: unknown } | undefined) {
    const conversationId = data?.conversationId;
    if (typeof conversationId !== 'string' || !conversationId) return;
    typingConversations(socket).add(conversationId);
    // Broadcast the authenticated caller's own identity, not whatever
    // email the client payload claims. conversationId lets receivers scope
    // the indicator to the conversation it belongs to.
    socket.to(`chat_room_${conversationId}`).emit("start typing", {
        email: socket.data.email,
        conversationId
    });
}

function handleStopTyping(socket: AppSocket, data: { conversationId?: unknown } | undefined) {
    const conversationId = data?.conversationId;
    if (typeof conversationId !== 'string' || !conversationId) return;
    announceStopTyping(socket, conversationId);
}

// nsp.to().except() rather than socket.to(): this also runs from the
// disconnect handler, after the socket itself has gone.
function announceStopTyping(socket: AppSocket, conversationId: string) {
    typingConversations(socket).delete(conversationId);
    socket.nsp.to(`chat_room_${conversationId}`).except(socket.id).emit("stop typing", {
        email: socket.data.email,
        conversationId
    });
}

function stopAllTyping(socket: AppSocket) {
    for (const conversationId of [...typingConversations(socket)]) {
        announceStopTyping(socket, conversationId);
    }
}

async function handleNotificationsUpdate(socket: AppSocket, email: string) {
    const notifications = await RedisService.getNotifications(email);
    socket.emit("notifications update", notifications);
}

async function handleNotificationsChecked(roomID: string, email: string) {
    await RedisService.clearNotification(email, roomID);
}

async function handleGetLocation(io: AppServer, socket: AppSocket) {
    const positions = await GetLocations();
    io.to(socket.id).emit('get locations', positions);
}

// email -> the last fix actually written for that account. The client already
// throttles, but several open tabs (or a misbehaving client) each emitting on
// their own schedule shouldn't add up to more writes than one tab would make.
const lastSavedLocations = new Map<string, SavedFix>();

// Acks whether the stored position now matches this fix - false only when it
// was held back for being too soon after the last write (or the write
// failed), so the client knows to offer it again rather than assume it's in.
async function handleSaveLocation(io: AppServer, socket: AppSocket, location: { latitude?: unknown; longitude?: unknown; accuracy?: unknown } | undefined, ack?: unknown) {
    const reply = typeof ack === 'function' ? ack as (saved: boolean) => void : () => { };
    const email = socket.data.email;
    const latitude = Number(location?.latitude);
    const longitude = Number(location?.longitude);
    const accuracy = Number(location?.accuracy);
    if (!email || !Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(accuracy)) return reply(false);

    const key = email.toLowerCase();
    const previous = lastSavedLocations.get(key);
    const fix = { latitude, longitude, accuracy, at: Date.now() };
    if (previous && isSameSpot(previous, fix)) return reply(true);
    if (!shouldPersistFix(previous, fix)) return reply(false);

    // Claimed before the write so a second emit arriving mid-write is
    // measured against this one rather than slipping through.
    lastSavedLocations.set(key, fix);
    try {
        const saved = await SaveLocations(email, { latitude, longitude, accuracy, time: new Date(fix.at) });
        reply(true);
        // Just the saver's new position, not the whole list - 'get locations'
        // (on page load) is what fetches everyone else's.
        io.to(socket.id).emit('location saved', saved);
    } catch {
        if (lastSavedLocations.get(key) === fix) {
            if (previous) lastSavedLocations.set(key, previous);
            else lastSavedLocations.delete(key);
        }
        reply(false);
    }
}

async function handleBanUser(io: AppServer, socket: AppSocket, data: { userEmail?: string; message?: string } | undefined) {
    const { userEmail, message } = data || {};
    const callerEmail = socket.data.email;
    if (!userEmail || !callerEmail) return;

    const isSelfReport = userEmail.toLowerCase() === callerEmail.toLowerCase();

    if (isSelfReport) {
        // A user's own client reporting that the moderation system just
        // auto-banned them for a message it rejected - confirm that's
        // actually true before broadcasting/disconnecting.
        const banStatus = await ModerationService.isUserBanned(socket.data.userId);
        if (!banStatus.isBanned) return;
    } else if (!(await isModerator(callerEmail))) {
        // Anyone banning someone else must be a moderator - otherwise this
        // is a way for any client to kick arbitrary users off the app.
        return;
    }

    io.emit('moderator_update_banned_user', { userEmail, message });
    const socketIds = await RedisService.getUserSocketsByEmail(userEmail);
    socketIds.forEach(socketId => {
        const targetSocket = io.sockets.sockets.get(socketId);
        if (targetSocket) {
            targetSocket.emit('banned', { message: message || 'Your account has been banned' });
            targetSocket.disconnect(true);
        }
    });

    await RedisService.clearAllNotifications(userEmail);
    for (const socketId of socketIds) {
        await RedisService.removeUserSocket(userEmail, socketId);
    }
}

async function handleUnbanUser(io: AppServer, socket: AppSocket, data: { userEmail?: string } | undefined) {
    const { userEmail } = data || {};
    if (!userEmail) return;
    if (!(await isModerator(socket.data.email))) return;

    io.emit('moderator_update_unbanned_user', { userEmail });
}

// Sent by the tab that just deleted its own account (DeleteAccountSection),
// so the account's other open tabs sign out too - the way a ban reaches them.
// Only acted on once the account really is gone, so a live account can't use
// it; the sender signs itself out, the rest are told and disconnected. Then
// the account leaves presence for good.
async function handleAccountDeleted(io: AppServer, socket: AppSocket, ack?: unknown) {
    const { email, userId } = socket.data;
    try {
        if (!email || !userId) return;
        if (await Account.exists({ _id: userId })) return;

        const socketIds = await RedisService.getUserSocketsByEmail(email);
        for (const socketId of socketIds) {
            if (socketId === socket.id) continue;
            const target = io.sockets.sockets.get(socketId);
            if (target) {
                target.emit('account deleted');
                target.disconnect(true);
            }
        }
        await RedisService.clearPresence(email);
        await handleUpdateConnectedUsers(io);
        await notifyAccountDeleted(io, userId);
    } finally {
        if (typeof ack === 'function') ack();
    }
}

// The people a deleted account was chatting with: each open chat swaps that
// member for "Deleted account" and shows the notice AccountDeletionService
// left in the conversation, without a reload. Anyone offline sees both the
// next time the chat loads.
async function notifyAccountDeleted(io: AppServer, deletedUserId: string) {
    const conversations = await Conversation.find({ deletedMembers: deletedUserId })
        .select('_id members')
        .lean<{ _id: { toString(): string }; members?: { toString(): string }[] }[]>();
    for (const conversation of conversations) {
        const notice = await Message.findOne({ conversation: conversation._id, system: 'account-deleted' })
            .sort({ date: -1 })
            .select('_id date status')
            .lean<{ _id: { toString(): string }; date: Date; status?: string } | null>();
        if (!notice) continue;
        const conversationID = conversation._id.toString();
        const payload = {
            conversationID,
            deletedMemberId: deletedUserId,
            message: { _id: notice._id.toString(), date: notice.date, sender: 'system', status: notice.status, system: 'account-deleted', conversationID },
        };
        const members = await Account.find({ _id: { $in: conversation.members ?? [] } }).select('email').lean<LeanAccount[]>();
        for (const member of members) {
            if (!member.email) continue;
            const socketIds = await RedisService.getUserSocketsByEmail(member.email);
            if (socketIds.length > 0) io.to(socketIds).emit('member account deleted', payload);
        }
    }
}

// Sent by a moderator's page right after promoteToModerator /
// demoteFromModerator succeeds, so the target's open tabs show or drop the
// Moderator link without a new login. Only their own sockets hear it, and
// it carries no flag: each tab re-reads its account through getCurrentUser,
// so a forged relay can't grant anything - at most it makes a tab re-check.
async function handleModeratorStatusChanged(io: AppServer, socket: AppSocket, data: { userEmail?: string } | undefined) {
    const { userEmail } = data || {};
    if (!userEmail) return;
    if (!(await isModerator(socket.data.email))) return;

    const socketIds = await RedisService.getUserSocketsByEmail(userEmail);
    socketIds.forEach(socketId => {
        io.sockets.sockets.get(socketId)?.emit('moderator status changed');
    });
}


async function handleLeaveRoom(body: { conversationId?: unknown } | undefined, socket: AppSocket) {
    const conversationId = body?.conversationId;
    // Leaving a conversation mid-sentence ends the indicator there, even if
    // the client's own 'stop typing' never arrives.
    if (typeof conversationId === 'string' && typingConversations(socket).has(conversationId)) {
        announceStopTyping(socket, conversationId);
    }
    socket.leave(`chat_room_${conversationId}`);
}

async function handleDisconnect(io: AppServer, email: string, socketId: string) {
    handleCallSocketDisconnect(io, email, socketId);
    await RedisService.removeUserSocket(email, socketId);

    // Only when the last socket for this account goes away - closing one of
    // several open tabs (or a reconnect) isn't leaving, and stamping a last
    // seen then would make someone who is plainly still online look gone.
    const remainingSockets = await RedisService.getUserSocketsByEmail(email);
    if (remainingSockets.length === 0) {
        await recordLastSeen(io, email);
    }

    await handleUpdateConnectedUsers(io);
}

// Stored on the account, then pushed to everyone already looking at a users
// list or chat header so it appears without a refresh. Held back from anyone
// this user has blocked, mirroring how handleUpdateConnectedUsers already
// hides a blocker's presence from the person they blocked - "last seen 2
// minutes ago" is the same information presence is.
async function recordLastSeen(io: AppServer, email?: string) {
    if (!email) return;

    const lastSeen = new Date();
    const account = await Account.findOneAndUpdate(
        { email },
        { $set: { lastSeen } }
    ).select('_id blocked').lean<LeanAccount | null>();
    if (!account) return;

    const blockedAccounts = (account.blocked || []).length
        ? await Account.find({ _id: { $in: account.blocked } }).select('email').lean<LeanAccount[]>()
        : [];
    const hiddenFrom = new Set(
        blockedAccounts.flatMap(blocked => blocked.email ? [blocked.email.toLowerCase()] : [])
    );

    const sockets = await io.fetchSockets();
    for (const s of sockets) {
        const viewerEmail = s.data.email?.toLowerCase();
        if (viewerEmail && hiddenFrom.has(viewerEmail)) continue;
        s.emit('user last seen', { email, lastSeen: lastSeen.toISOString() });
    }
}

// ---------------------------------------------------------------------------
// 1:1 calls - WebRTC signaling relay
//
// Audio and video go peer to peer. This server only relays the small SDP and
// ICE messages two browsers need to find each other, plus the ringing state
// around them. Calls live in memory on this process, keyed by account email
// (one call per account), because a call only exists while both sockets do:
// there's no call history, and nothing here is worth persisting.
//
// A call is bound to one socket per side (the caller's, and whichever of the
// callee's tabs answered), and everything after the answer is relayed to that
// exact socket. The invite itself goes to every socket the callee has, not
// only ones in chat_room_<id>: someone in a different conversation, or on the
// chat list, hasn't joined that room but still has to see the call ringing.
// ---------------------------------------------------------------------------

const activeCalls = new Map<string, ActiveCall>(); // lowercased email -> call (both sides share one record)

const CALL_RING_TIMEOUT_MS = 30 * 1000;
// Long enough for connectionStateRecovery to bring a socket back after a
// network blip (it keeps the same socket id), short enough that a closed tab
// ends the call for the other side quickly.
const CALL_DISCONNECT_GRACE_MS = 10 * 1000;
// A call normally trickles a few dozen candidates and a handful of offers
// (one per camera toggle) - the caps only stop a misbehaving client from
// flooding its peer.
const CALL_MAX_CANDIDATES = 300;
const CALL_MAX_DESCRIPTIONS = 100;
const CALL_MAX_SDP_LENGTH = 32 * 1024;
const CALL_MAX_CANDIDATE_LENGTH = 1024;
const CALL_PUSHES_PER_WINDOW = 10;
const CALL_PUSH_WINDOW_SECONDS = 10 * 60;
// Far above real use - only stops a client that spams invites from filling
// a conversation with call entries.
const CALL_RECORDS_PER_WINDOW = 30;
const CALL_RECORD_WINDOW_SECONDS = 10 * 60;
const MAX_PUSH_ENDPOINT_LENGTH = 2048;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;

// Call handlers run on every signal, so a rejected Redis/Mongo promise here
// must never become an unhandled rejection that takes the process down.
// Only the message is logged - a stack or payload could carry SDP. fn runs
// synchronously up to its first await, which the busy check in
// handleCallInvite relies on.
function safely(fn: () => unknown) {
    const logError = (error: unknown) => {
        const message = typeof error === 'object' && error !== null && 'message' in error ? error.message : undefined;
        console.error('Call signaling error:', message);
    };
    try {
        Promise.resolve(fn()).catch(logError);
    } catch (error) {
        logError(error);
    }
}

function normalizeEmail(email: unknown) {
    return typeof email === 'string' ? email.toLowerCase() : '';
}

function parseCallIds(data: CallSignal | undefined) {
    const callId = data?.callId;
    const conversationId = data?.conversationId;
    if (typeof callId !== 'string' || !UUID_PATTERN.test(callId)) return null;
    if (typeof conversationId !== 'string' || !OBJECT_ID_PATTERN.test(conversationId)) return null;
    return { callId, conversationId };
}

// The sender's call, only when the event names that exact call - a stale
// event from a previous call (or a guessed id) never touches the current one.
function findCall(email: string, ids: { callId: string; conversationId: string }) {
    const call = activeCalls.get(email);
    if (!call || call.callId !== ids.callId || call.conversationId !== ids.conversationId) return null;
    return call;
}

function isBoundSocket(call: ActiveCall, email: string, socketId: string) {
    return email === call.caller
        ? call.callerSocketId === socketId
        : call.calleeSocketId === socketId;
}

function peerSocketId(call: ActiveCall, email: string) {
    return email === call.caller ? call.calleeSocketId : call.callerSocketId;
}

// The other member's email, only when `email` is a member of a conversation
// with exactly two members - v1 calls are 1:1 only.
async function getOneToOnePeerEmail(conversationId: string, email: string) {
    try {
        const conversation = await Conversation.findById(conversationId).populate('members', 'email');
        if (!conversation) return null;
        const members = membersOf(conversation);
        if (members.length !== 2) return null;
        if (!members.some(member => normalizeEmail(member.email) === email)) return null;
        const other = members.find(member => normalizeEmail(member.email) !== email);
        return other?.email ? normalizeEmail(other.email) : null;
    } catch {
        return null;
    }
}

function clearCall(call: ActiveCall) {
    call.ended = true;
    if (call.ringTimer !== null) clearTimeout(call.ringTimer);
    for (const email of [call.caller, call.callee]) {
        if (activeCalls.get(email) === call) activeCalls.delete(email);
    }
}

// The Redis registry can outlive the sockets it lists (a server restart
// never runs their disconnect handlers), so "is the callee reachable" is
// answered from the sockets this process actually holds.
async function getLiveSocketIds(io: AppServer, email: string) {
    const socketIds = await RedisService.getUserSocketsByEmail(email);
    return socketIds.filter(id => io.sockets.sockets.has(id));
}

async function emitToCalleeSockets(io: AppServer, call: ActiveCall, event: string, payload: unknown, exceptSocketId?: string) {
    const socketIds = (await getLiveSocketIds(io, call.callee))
        .filter(id => id !== exceptSocketId);
    if (socketIds.length > 0) io.to(socketIds).emit(event, payload);
}

// Server-side end (block, a socket that never came back, a replaced call) -
// tells both sides. clearCall runs before the first await so nothing else
// can act on this call in the meantime.
async function endCall(io: AppServer, call: ActiveCall, reason: string) {
    if (call.ended) return;
    const wasRinging = call.state === 'ringing';
    clearCall(call);
    const payload = { callId: call.callId, conversationId: call.conversationId, reason };
    io.to(call.callerSocketId).emit('call hangup', payload);
    if (wasRinging) {
        await emitToCalleeSockets(io, call, 'call cancel', payload);
    } else if (call.calleeSocketId) {
        io.to(call.calleeSocketId).emit('call hangup', payload);
    }
    // 'ended' is a block - nothing more reaches a blocked pair.
    if (reason === 'ended') return;
    if (wasRinging) {
        await pushMissedCall(call);
        await recordCall(io, call, 'cancelled');
    } else {
        await recordCall(io, call, 'completed');
    }
}

function inviteFor(call: ActiveCall) {
    return {
        callId: call.callId,
        conversationId: call.conversationId,
        video: call.video,
        from: call.caller,
        fromName: call.callerName
    };
}

async function handleCallInvite(io: AppServer, socket: AppSocket, data: CallSignal | undefined) {
    const ids = parseCallIds(data);
    if (!ids || typeof data?.video !== 'boolean') return;
    const email = normalizeEmail(socket.data.email);

    const peerEmail = await getOneToOnePeerEmail(ids.conversationId, email);
    if (!peerEmail) return;
    if (await isBlockedEitherWay(email, peerEmail)) {
        // Same neutral wording as a blocked message - never "you're blocked".
        socket.emit('call unavailable', { ...ids, reason: 'unavailable' });
        return;
    }

    // No awaits from here until the record is in the Map, so two invites
    // racing each other can't both pass the busy check.
    const existing = activeCalls.get(email);
    if (existing) {
        if (existing.callId === ids.callId) return;
        // One call at a time: starting a new one ends whatever this account
        // was already in (the client hangs up first too - this covers a
        // second tab, or a hangup that never arrived).
        safely(() => endCall(io, existing, 'replaced'));
    }
    if (activeCalls.has(peerEmail)) {
        socket.emit('call busy', ids);
        await recordCall(io, { ...ids, caller: email, callee: peerEmail, video: data.video, acceptedAt: null }, 'busy');
        return;
    }

    const call: ActiveCall = {
        ...ids,
        caller: email,
        callee: peerEmail,
        callerSocketId: socket.id,
        calleeSocketId: null,
        state: 'ringing',
        video: data.video,
        candidates: 0,
        descriptions: 0,
        calleeWasReachable: false,
        callerName: email.split('@')[0],
        pushed: false,
        acceptedAt: null,
        ringTimer: null,
        ended: false
    };
    activeCalls.set(email, call);
    activeCalls.set(peerEmail, call);
    call.ringTimer = setTimeout(() => safely(() => handleCallRingTimeout(io, call)), CALL_RING_TIMEOUT_MS);

    const [calleeSockets, callerName] = await Promise.all([
        getLiveSocketIds(io, peerEmail),
        getNickname(email)
    ]);
    if (call.ended) return;
    if (callerName) call.callerName = callerName;
    if (calleeSockets.length > 0) {
        call.calleeWasReachable = true;
        io.to(calleeSockets).emit('call invite', inviteFor(call));
    }
    // A connected socket doesn't mean anyone can see the call: a phone keeps
    // a backgrounded (or locked) tab's socket alive for minutes, and a hidden
    // page can't put anything on screen. So the push goes out unless one of
    // the callee's tabs is actually visible - including when another device
    // of theirs is connected but sitting in the background.
    const onScreen = calleeSockets.some(id => io.sockets.sockets.get(id)?.data.appVisible);
    if (!onScreen) await pushIncomingCall(call);
}

async function getNickname(email: string) {
    try {
        const account = await Account.findOne({ email }).select('nickname').lean<LeanAccount | null>();
        return account?.nickname || null;
    } catch {
        return null;
    }
}

// Call pushes go to the callee, so they're worded in the callee's account
// language - there's no request here to read a cookie from.
async function calleeTranslator(call: ActiveCall) {
    const account = await Account.findOne({ email: call.callee }).select('locale').lean<{ locale?: string }>();
    return translatorFor(account?.locale);
}

// A push can't carry the call - it only gets the callee to open the app,
// where 'call sync' picks up the invite if it's still ringing.
async function pushIncomingCall(call: ActiveCall) {
    const allowed = await RedisService.checkRateLimit(
        'call-push', call.caller, CALL_PUSHES_PER_WINDOW, CALL_PUSH_WINDOW_SECONDS
    );
    if (!allowed || call.ended) return;
    call.pushed = true;
    const t = await calleeTranslator(call);
    await sendPushToEmails([call.callee], {
        title: call.video ? t('notifications.incomingVideo') : t('notifications.incomingVoice'),
        body: t('notifications.calling', { name: call.callerName }),
        kind: 'call',
    });
}

// Replaces the ringing notification, which would otherwise keep saying
// "is calling you" after the call stopped. Only sent after a ring push, so
// it stays within the call-push rate limit.
async function pushMissedCall(call: ActiveCall) {
    if (!call.pushed) return;
    const t = await calleeTranslator(call);
    await sendPushToEmails([call.callee], {
        title: t('notifications.missedTitle'),
        body: call.video ? t('notifications.missedVideo', { name: call.callerName }) : t('notifications.missedVoice', { name: call.callerName }),
        kind: 'missed-call',
    });
}

// The device that answered or declined sends its own push endpoint, so every
// other device of the callee's can be told - otherwise a phone whose page is
// frozen keeps "is calling you" in its shade for a call already taken.
function parsePushEndpoint(data: CallSignal | undefined) {
    const endpoint = data?.pushEndpoint;
    return typeof endpoint === 'string' && endpoint.length <= MAX_PUSH_ENDPOINT_LENGTH ? endpoint : undefined;
}

// Replaces the ring on the callee's other devices. It has to be a real
// (silent) notification rather than just closing the ring - see the push
// handler in public/service-worker.js for why every push shows one.
async function pushCallHandledElsewhere(call: ActiveCall, how: 'answered' | 'declined', exceptEndpoint: string | undefined) {
    if (!call.pushed) return;
    const t = await calleeTranslator(call);
    await sendPushToEmails([call.callee], {
        title: call.callerName,
        body: how === 'answered' ? t('notifications.answeredElsewhere') : t('notifications.declinedElsewhere'),
        kind: 'call-handled',
    }, { exceptEndpoint });
}

interface LeanConversationSettings {
    disappearingMessagesSeconds?: number;
}

// One history entry per call, written when the call ends - only the server
// knows how every call ended (the caller's tab may be gone by then), so this
// can't go through saveMessage the way a message does. Every end path runs
// clearCall first and bails if the call had already ended, so a call is
// recorded exactly once. Never throws: a failed write only loses the entry.
async function recordCall(
    io: AppServer,
    call: Pick<ActiveCall, 'conversationId' | 'caller' | 'callee' | 'video' | 'acceptedAt'>,
    outcome: CallOutcome
) {
    try {
        const allowed = await RedisService.checkRateLimit(
            'call-record', call.caller, CALL_RECORDS_PER_WINDOW, CALL_RECORD_WINDOW_SECONDS
        );
        if (!allowed) return;
        const conversation = await Conversation.findById(call.conversationId)
            .select('disappearingMessagesSeconds')
            .lean<LeanConversationSettings | null>();
        if (!conversation) return;

        const missed = MISSED_CALL_OUTCOMES.includes(outcome);
        const durationSeconds = outcome === 'completed' && call.acceptedAt
            ? Math.max(0, Math.round((Date.now() - call.acceptedAt) / 1000))
            : 0;
        const record = await Message.create({
            sender: call.caller,
            conversation: call.conversationId,
            call: { video: call.video, outcome, durationSeconds },
            // A call the callee picked up (or turned down) is already seen;
            // a missed one stays unread until they open the conversation,
            // same as a message.
            status: missed ? 'sent' : 'read',
            expiresAt: conversation.disappearingMessagesSeconds
                ? new Date(Date.now() + conversation.disappearingMessagesSeconds * 1000)
                : undefined
        });
        // Same as a new message: back into the list of anyone who deleted
        // the conversation, and part of its history from now on.
        await Conversation.updateOne(
            { _id: call.conversationId },
            { $set: { deletedBy: [] }, $push: { messages: record._id } }
        );

        const payload = {
            _id: record._id.toString(),
            date: record.date,
            sender: record.sender,
            status: record.status,
            call: { video: call.video, outcome, durationSeconds },
            conversationID: call.conversationId
        };
        const roomSockets = await io.in(`chat_room_${call.conversationId}`).allSockets();
        for (const email of [call.caller, call.callee]) {
            const socketIds = await getLiveSocketIds(io, email);
            if (email === call.callee && missed && !socketIds.some(id => roomSockets.has(id))) {
                await RedisService.incrNotification(email, call.conversationId, 1);
                const notifications = await RedisService.getNotifications(email);
                if (socketIds.length > 0) io.to(socketIds).emit('notifications update', notifications);
            }
            if (socketIds.length > 0) io.to(socketIds).emit('call record', payload);
        }
    } catch (error) {
        const message = typeof error === 'object' && error !== null && 'message' in error ? error.message : undefined;
        console.error('Failed to record call:', message);
    }
}

async function handleCallRingTimeout(io: AppServer, call: ActiveCall) {
    if (call.ended || call.state !== 'ringing') return;
    clearCall(call);
    const ids = { callId: call.callId, conversationId: call.conversationId };
    io.to(call.callerSocketId).emit('call unavailable', {
        ...ids,
        reason: call.calleeWasReachable ? 'no-answer' : 'offline'
    });
    await emitToCalleeSockets(io, call, 'call cancel', { ...ids, reason: 'missed' });
    await pushMissedCall(call);
    await recordCall(io, call, 'no-answer');
}

async function handleCallAccept(io: AppServer, socket: AppSocket, data: CallSignal | undefined) {
    const ids = parseCallIds(data);
    if (!ids) return;
    const email = normalizeEmail(socket.data.email);
    const call = findCall(email, ids);
    if (!call || call.state !== 'ringing' || call.callee !== email) return;

    if (await isBlockedEitherWay(call.caller, call.callee)) {
        await endCall(io, call, 'ended');
        return;
    }
    // Another tab answered, or the caller cancelled, during that await.
    if (call.ended || call.state !== 'ringing') return;

    if (call.ringTimer !== null) clearTimeout(call.ringTimer);
    call.state = 'active';
    call.calleeSocketId = socket.id;
    call.acceptedAt = Date.now();
    io.to(call.callerSocketId).emit('call accept', ids);
    await emitToCalleeSockets(io, call, 'call cancel', { ...ids, reason: 'answered-elsewhere' }, socket.id);
    await pushCallHandledElsewhere(call, 'answered', parsePushEndpoint(data));
}

async function handleCallDecline(io: AppServer, socket: AppSocket, data: CallSignal | undefined) {
    const ids = parseCallIds(data);
    if (!ids) return;
    const email = normalizeEmail(socket.data.email);
    const call = findCall(email, ids);
    if (!call || call.state !== 'ringing' || call.callee !== email) return;

    clearCall(call);
    io.to(call.callerSocketId).emit('call decline', ids);
    await emitToCalleeSockets(io, call, 'call cancel', { ...ids, reason: 'declined-elsewhere' }, socket.id);
    await pushCallHandledElsewhere(call, 'declined', parsePushEndpoint(data));
    await recordCall(io, call, 'declined');
}

async function handleCallCancel(io: AppServer, socket: AppSocket, data: CallSignal | undefined) {
    const ids = parseCallIds(data);
    if (!ids) return;
    const email = normalizeEmail(socket.data.email);
    const call = findCall(email, ids);
    if (!call || call.state !== 'ringing' || call.caller !== email || call.callerSocketId !== socket.id) return;

    clearCall(call);
    await emitToCalleeSockets(io, call, 'call cancel', { ...ids, reason: 'cancelled' });
    await pushMissedCall(call);
    await recordCall(io, call, 'cancelled');
}

async function handleCallHangup(io: AppServer, socket: AppSocket, data: CallSignal | undefined) {
    const ids = parseCallIds(data);
    if (!ids) return;
    const email = normalizeEmail(socket.data.email);
    const call = findCall(email, ids);
    if (!call) return;

    // Hanging up before an answer is a cancel (caller) or a decline (callee).
    if (call.state === 'ringing') {
        if (email === call.caller) await handleCallCancel(io, socket, data);
        else await handleCallDecline(io, socket, data);
        return;
    }
    if (!isBoundSocket(call, email, socket.id)) return;

    clearCall(call);
    // 'failed' lets the other side offer a retry too, instead of a plain
    // "call ended" for a call that never managed to connect. Nothing else
    // from the client is passed through.
    const reason = data?.reason === 'failed' ? 'failed' : 'hangup';
    const peerId = peerSocketId(call, email);
    if (peerId) io.to(peerId).emit('call hangup', { ...ids, reason });
    await recordCall(io, call, reason === 'failed' ? 'failed' : 'completed');
}

function sanitizeDescription(description: unknown): SessionDescription | null {
    if (!description || typeof description !== 'object') return null;
    const { type, sdp } = description as { type?: unknown; sdp?: unknown };
    if (type !== 'offer' && type !== 'answer') return null;
    if (typeof sdp !== 'string' || sdp.length === 0 || sdp.length > CALL_MAX_SDP_LENGTH) return null;
    return { type, sdp };
}

function sanitizeCandidate(candidate: unknown): IceCandidate | null {
    if (!candidate || typeof candidate !== 'object') return null;
    const { candidate: line, sdpMid, sdpMLineIndex, usernameFragment } = candidate as {
        candidate?: unknown;
        sdpMid?: unknown;
        sdpMLineIndex?: unknown;
        usernameFragment?: unknown;
    };
    if (typeof line !== 'string' || line.length > CALL_MAX_CANDIDATE_LENGTH) return null;
    if (sdpMid != null && (typeof sdpMid !== 'string' || sdpMid.length > 64)) return null;
    if (sdpMLineIndex != null && (typeof sdpMLineIndex !== 'number' || !Number.isInteger(sdpMLineIndex) || sdpMLineIndex < 0 || sdpMLineIndex > 64)) return null;
    if (usernameFragment != null && (typeof usernameFragment !== 'string' || usernameFragment.length > 256)) return null;
    return {
        candidate: line,
        sdpMid: typeof sdpMid === 'string' ? sdpMid : null,
        sdpMLineIndex: typeof sdpMLineIndex === 'number' ? sdpMLineIndex : null,
        ...(typeof usernameFragment === 'string' ? { usernameFragment } : {})
    };
}

// SDP and candidates are never logged - they carry the peers' IP addresses.
function handleCallSignal(io: AppServer, socket: AppSocket, data: CallSignal | undefined) {
    const ids = parseCallIds(data);
    if (!ids) return;
    const email = normalizeEmail(socket.data.email);
    const call = findCall(email, ids);
    if (!call || call.state !== 'active' || !isBoundSocket(call, email, socket.id)) return;

    const relay: {
        callId: string;
        conversationId: string;
        description?: SessionDescription;
        candidate?: IceCandidate;
    } = { ...ids };
    if (data?.description != null) {
        const description = sanitizeDescription(data.description);
        if (!description || ++call.descriptions > CALL_MAX_DESCRIPTIONS) return;
        relay.description = description;
    } else if (data?.candidate != null) {
        const candidate = sanitizeCandidate(data.candidate);
        if (!candidate || ++call.candidates > CALL_MAX_CANDIDATES) return;
        relay.candidate = candidate;
    } else {
        return;
    }
    const peerId = peerSocketId(call, email);
    if (!peerId) return;
    io.to(peerId).emit('call signal', relay);
}

// A tab that opens the chat while a call to this account is still ringing -
// typically from the call push above, or a reload - asks for the invite it
// missed.
function handleCallSync(socket: AppSocket) {
    const email = normalizeEmail(socket.data.email);
    const call = activeCalls.get(email);
    if (!call || call.state !== 'ringing' || call.callee !== email) return;
    call.calleeWasReachable = true;
    socket.emit('call invite', inviteFor(call));
}

// Only the socket a call is bound to matters - the call's media lives in
// that tab, so another tab of the same account staying open doesn't keep it
// alive. A ringing callee isn't bound yet; ringing just continues on any
// other tab until the timeout.
function handleCallSocketDisconnect(io: AppServer, email: string, socketId: string) {
    const normalized = normalizeEmail(email);
    const call = activeCalls.get(normalized);
    if (!call || !isBoundSocket(call, normalized, socketId)) return;

    setTimeout(() => {
        // connectionStateRecovery restores the same socket id after a blip.
        if (call.ended || io.sockets.sockets.has(socketId)) return;
        safely(() => endCall(io, call, 'disconnected'));
    }, CALL_DISCONNECT_GRACE_MS);
}

async function handleCallBlockCheck(io: AppServer, email: string) {
    const call = activeCalls.get(normalizeEmail(email));
    if (!call) return;
    if (await isBlockedEitherWay(call.caller, call.callee)) {
        // 'ended', not 'blocked' - the other side isn't told why.
        await endCall(io, call, 'ended');
    }
}
