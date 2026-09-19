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

export default async function handleSocketConnection(io, socket) {
    // The authenticated identity comes from authMiddleware, which verifies
    // the JWT - never from client-supplied handshake headers.
    const email = socket.data.email;

    try {
        await RedisService.addUserSocket(email, socket.id);
        const allUsers = await RedisService.getOnlineUsers();
        socket.on('update connected users', () => handleUpdateConnectedUsers(io));
        io.emit('update connected users', allUsers);

        socket.on('join room', (body) => handleJoinRoom(body, socket));
        socket.on('publish message', (message) => handlePublishMessage(io, socket, message));
        socket.on('delete message', (message) => handleDeleteMessage(io, socket, message));
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

async function handleUpdateConnectedUsers(io) {
    const fresh = await RedisService.getOnlineUsers();
    io.emit('update connected users', fresh);
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

    for (const member of conversation.members) {
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
    const conversationId = message?.conversationID;
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
    await handleUpdateConnectedUsers(io);
}
