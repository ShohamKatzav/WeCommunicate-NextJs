import RedisService from '@/services/RedisService';
import ModerationService from '@/services/ModerationService';
import { GetLocations, SaveLocations } from "@/app/lib/locationActions";
import Conversation from '@/models/Conversation'
import Message from '@/models/Message'
import Account from '@/models/Account'

async function isConversationMember(conversationId, email) {
    if (!conversationId || !email) return false;
    try {
        const conversation = await Conversation.findById(conversationId).populate('members', 'email');
        if (!conversation) return false;
        return conversation.members.some(member => member.email?.toLowerCase() === email.toLowerCase());
    } catch {
        return false;
    }
}

async function isModerator(email) {
    if (!email) return false;
    const account = await Account.findOne({ email }).select('isModerator').lean();
    return Boolean(account?.isModerator);
}

// Mirrors AccountRepository.isBlockedEitherWay (TypeScript, used by
// chatActions.saveMessage) - duplicated here rather than imported because
// this file works with models directly, not repositories, and the check is
// small. If either side has blocked the other, messaging between them stops.
async function isBlockedEitherWay(emailA, emailB) {
    if (!emailA || !emailB) return false;
    const [accountA, accountB] = await Promise.all([
        Account.findOne({ email: emailA }).select('_id blocked').lean(),
        Account.findOne({ email: emailB }).select('_id blocked').lean()
    ]);
    if (!accountA || !accountB) return false;
    const idA = accountA._id.toString();
    const idB = accountB._id.toString();
    const blockedByA = (accountA.blocked || []).some(id => id.toString() === idB);
    const blockedByB = (accountB.blocked || []).some(id => id.toString() === idA);
    return blockedByA || blockedByB;
}

export default async function handleSocketConnection(io, socket) {
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
        socket.on('update connected users', () => handleUpdateConnectedUsers(io));
        socket.on('join room', (body) => handleJoinRoom(body, socket));
        socket.on('message read', (data) => handleMessageRead(io, socket, data));
        socket.on('publish message', (message) => handlePublishMessage(io, socket, message));
        socket.on('delete message', (message) => handleDeleteMessage(io, socket, message));
        socket.on('react to message', (data) => handleReactToMessage(io, socket, data));
        socket.on('notifications update', () => handleNotificationsUpdate(socket, email));
        socket.on("notifications checked", (roomID) => handleNotificationsChecked(roomID, email));
        socket.on('get locations', () => handleGetLocation(io, socket));
        socket.on('save location', (location) => handleSaveLocation(io, socket, location));
        socket.on('leave room', (body) => handleLeaveRoom(body, socket));
        socket.on('ban user', (data) => handleBanUser(io, socket, data));
        socket.on('unban user', (data) => handleUnbanUser(io, socket, data));
        socket.on('disconnect', () => handleDisconnect(io, email, socket.id));
        socket.on('start typing', (data) => handleStartTyping(socket, data));
        socket.on('stop typing', (data) => handleStopTyping(socket, data));

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

async function handleJoinRoom(body, socket) {
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
async function handleMessageRead(io, socket, data) {
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
async function handleUpdateConnectedUsers(io) {
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
        .lean();
    const emailById = new Map(
        accounts.flatMap(a => a.email ? [[a._id.toString(), a.email.toLowerCase()]] : [])
    );

    // targetEmail -> set of emails that have blocked them.
    const blockersOf = new Map();
    for (const account of accounts) {
        if (!account.email) continue;
        for (const blockedId of account.blocked || []) {
            const targetEmail = emailById.get(blockedId.toString());
            if (!targetEmail) continue; // the account they blocked isn't online right now
            if (!blockersOf.has(targetEmail)) blockersOf.set(targetEmail, new Set());
            blockersOf.get(targetEmail).add(account.email.toLowerCase());
        }
    }

    for (const s of sockets) {
        const viewerEmail = s.data.email?.toLowerCase();
        const blockers = viewerEmail ? blockersOf.get(viewerEmail) : undefined;
        const filtered = blockers
            ? allOnline.filter(u => !blockers.has(u.email?.toLowerCase()))
            : allOnline;
        s.emit('update connected users', filtered);
    }
}

async function handlePublishMessage(io, socket, message) {
    if (!message?.conversationID || !message?.sender) return;
    // The sender the message is published as must match the authenticated
    // caller - otherwise a client could spoof messages "from" anyone else.
    if (message.sender.toLowerCase() !== socket.data.email?.toLowerCase()) return;

    const room = `chat_room_${message.conversationID}`;
    const conversation = await Conversation.findById(message.conversationID).populate('members', 'email');
    if (!conversation) return;

    const isMember = conversation.members.some(
        member => member.email?.toLowerCase() === socket.data.email?.toLowerCase()
    );
    if (!isMember) return;

    // Real-time fan-out is the last line of defence against a client that
    // emits 'publish message' directly instead of going through the
    // saveMessage server action (which already rejects blocked 1:1 sends
    // before they're ever persisted) - defense in depth, not the primary
    // enforcement point. 1:1 only, same scope as saveMessage's own check.
    if (conversation.members.length === 2) {
        const otherMember = conversation.members.find(
            member => member.email?.toLowerCase() !== socket.data.email?.toLowerCase()
        );
        if (otherMember && await isBlockedEitherWay(message.sender, otherMember.email)) {
            return;
        }
    }

    for (const member of conversation.members) {
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

async function handleDeleteMessage(io, socket, message) {
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
    const messageDoc = await Message.findById(message._id).select('sender');
    if (!messageDoc || messageDoc.sender?.toLowerCase() !== socket.data.email?.toLowerCase()) return;

    const room = `chat_room_${conversationId}`;
    io.to(room).emit('delete message', message);

    const conversation = await Conversation.findById(conversationId).populate('members', 'email');
    if (conversation) {
        for (const member of conversation.members) {
            const memberSocketIds = await RedisService.getUserSocketsByEmail(member.email);
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

// The reaction itself was already persisted by the toggleMessageReaction
// server action before this fires - this only fans the change out to whoever
// has the conversation open. The reactions broadcast are re-read from the
// document rather than taken from the client payload, so a client can't
// announce reactions that were never stored.
async function handleReactToMessage(io, socket, data) {
    const messageId = data?.messageId;
    if (!messageId) return;

    const message = await Message.findById(messageId).select('conversation reactions').lean();
    if (!message) return;

    const conversationId = message.conversation.toString();
    if (!(await isConversationMember(conversationId, socket.data.email))) return;

    io.to(`chat_room_${conversationId}`).emit('message reactions', {
        messageId: message._id.toString(),
        conversationId,
        reactions: message.reactions || []
    });
}

async function handleStartTyping(socket, data) {
    const room = `chat_room_${data.conversationId}`;
    // Broadcast the authenticated caller's own identity, not whatever
    // email the client payload claims.
    socket.to(room).emit("start typing", { email: socket.data.email });
}

async function handleStopTyping(socket, data) {
    const room = `chat_room_${data.conversationId}`;
    socket.to(room).emit("stop typing", { email: socket.data.email });
}

async function handleNotificationsUpdate(socket, email) {
    const notifications = await RedisService.getNotifications(email);
    socket.emit("notifications update", notifications);
}

async function handleNotificationsChecked(roomID, email) {
    await RedisService.clearNotification(email, roomID);
}

async function handleGetLocation(io, socket) {
    const positions = await GetLocations();
    io.to(socket.id).emit('get locations', positions);
}

async function handleSaveLocation(io, socket, location) {
    await SaveLocations(socket.data.email, location);
    await handleGetLocation(io, socket);
}

async function handleBanUser(io, socket, data) {
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

async function handleUnbanUser(io, socket, data) {
    const { userEmail } = data || {};
    if (!userEmail) return;
    if (!(await isModerator(socket.data.email))) return;

    io.emit('moderator_update_unbanned_user', { userEmail });
}


async function handleLeaveRoom(body, socket) {
    const room = `chat_room_${body.conversationId}`;
    socket.leave(room);
}

async function handleDisconnect(io, email, socketId) {
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
async function recordLastSeen(io, email) {
    if (!email) return;

    const lastSeen = new Date();
    const account = await Account.findOneAndUpdate(
        { email },
        { $set: { lastSeen } }
    ).select('_id blocked').lean();
    if (!account) return;

    const blockedAccounts = (account.blocked || []).length
        ? await Account.find({ _id: { $in: account.blocked } }).select('email').lean()
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
