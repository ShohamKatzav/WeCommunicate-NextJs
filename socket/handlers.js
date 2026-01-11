import RedisService from '@/services/RedisService';
import { GetLocations, SaveLocations } from "@/app/lib/locationActions";
import Conversation from '@/models/Conversation'

export default async function handleSocketConnection(io, socket) {
    const email = socket.handshake.headers?.email;
    const conversationId = socket.handshake.headers?.conversationid;

    try {
        await RedisService.addUserSocket(email, socket.id);
        const allUsers = await RedisService.getOnlineUsers();
        socket.on('update connected users', () => handleUpdateConnectedUsers(io));
        io.emit('update connected users', allUsers);

        if (conversationId) {
            const room = `chat_room_${conversationId}`;
            socket.join(room);
        }

        socket.on('join room', (body) => handleJoinRoom(body, socket));
        socket.on('publish message', (message) => handlePublishMessage(io, socket, message));
        socket.on('delete message', (message) => handleDeleteMessage(io, message));
        socket.on('notifications update', () => handleNotificationsUpdate(socket, email));
        socket.on("notifications checked", (roomID) => handleNotificationsChecked(roomID, email));
        socket.on('get locations', () => handleGetLocation(io, socket));
        socket.on('save location', (location) => handleSaveLocation(io, socket, location));
        socket.on('leave room', (body) => handleLeaveRoom(body, socket));
        socket.on('ban user', (data) => handleBanUser(io, data));
        socket.on('unban user', (data) => handleUnbanUser(io, data));
        socket.on('disconnect', () => handleDisconnect(io, email, socket.id));

    }
    catch (error) {
        console.error('Socket connection error:', error);
        socket.disconnect(true);
    }
}

async function handleJoinRoom(body, socket) {
    const room = `chat_room_${body.conversationId}`;
    socket.join(room);
}

async function handleUpdateConnectedUsers(io) {
    const fresh = await RedisService.getOnlineUsers();
    io.emit('update connected users', fresh);
}

async function handlePublishMessage(io, socket, message) {
    const room = `chat_room_${message?.conversationID}`;
    const conversation = await Conversation.findById(message?.conversationID).populate('members', 'email');

    if (conversation) {
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
}

async function handleDeleteMessage(io, message) {
    const room = `chat_room_${message?.conversation}`;
    io.to(room).emit('delete message', message);
    const conversation = await Conversation.findById(message?.conversation).populate('members', 'email');
    if (conversation) {
        for (const member of conversation.members) {
            const memberSocketId = await RedisService.getUserSocketsByEmail(member.email);
            const roomSockets = await io.in(room).allSockets();
            const isInRoom = memberSocketId && roomSockets.has(memberSocketId);
            if (!isInRoom) {
                if (memberSocketId) {
                    io.to(memberSocketId).emit('delete message', message);
                }
            }
        }
    }
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
    await SaveLocations(location);
    await handleGetLocation(io, socket);
}
async function handleBanUser(io, data) {
    const { userEmail, message } = data;
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

async function handleUnbanUser(io, data) {
    const { userEmail } = data;
    io.emit('moderator_update_unbanned_user', userEmail);
}


async function handleLeaveRoom(body, socket) {
    const room = `chat_room_${body.conversationId}`;
    socket.leave(room);
}

async function handleDisconnect(io, email, socketId) {
    await RedisService.removeUserSocket(email, socketId);
    await handleUpdateConnectedUsers(io);
}