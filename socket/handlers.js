import RedisService from '@/services/RedisService';
import { GetLocations, SaveLocations } from "@/app/lib/locationActions";
import Conversation from '@/models/Conversation'

export default async function handleSocketConnection(io, socket) {
    const email = socket.handshake.headers?.email;
    const conversationId = socket.handshake.headers?.conversationid;

    try {
        RedisService.getInstance();
        await RedisService.addUserSocket(email, socket.id);
        const allUsers = await RedisService.getUserSockets();
        socket.on('update connected users', () => handleUpdateConnectedUsers(io));
        io.emit('update connected users', allUsers);

        if (conversationId) {
            const room = `chat_room_${conversationId}`;
            socket.join(room);
        }

        socket.on('join room', (body) => handleJoinRoom(body, socket));
        socket.on('publish message', (message) => handlePublishMessage(io, socket, message));
        socket.on('delete message', (message) => handleDeleteMessage(io, socket, message));
        socket.on('notifications update', () => handleNotificationsUpdate(socket, email));
        socket.on("notifications checked", (roomID) => handleNotificationsChecked(roomID, email));
        socket.on('get locations', () => handleGetLocation(io, socket));
        socket.on('save location', (location) => handleSaveLocation(io, socket, location));
        socket.on('leave room', (body) => handleLeaveRoom(body, socket));
        socket.on('disconnect', () => handleDisconnect(io, email));

    }
    catch (error) {
        console.error('Socket connection error:', error);
        socket.disconnect(true);
    }
}

async function handleJoinRoom(body, socket) {
    const room = `chat_room_${body.conversationId}`;
    console.log("Joining:", room);
    socket.join(room);
}

async function handleUpdateConnectedUsers(io) {
    const fresh = await RedisService.getUserSockets();
    io.emit('update connected users', fresh);
}

async function handlePublishMessage(io, socket, message) {

    const room = `chat_room_${message?.conversationID}`;
    socket.to(room).emit('publish message', message);
    const conversation = await Conversation.findById(message?.conversationID).populate('members', 'email');

    if (conversation) {
        for (const member of conversation.members) {
            if (member.email.toUpperCase() === message.sender.toUpperCase()) continue;
            const memberSocketId = await RedisService.getUserSocketByEmail(member.email);
            const roomSockets = await io.in(room).allSockets();
            const isInRoom = memberSocketId && roomSockets.has(memberSocketId);
            console.log(io);
            console.log(room);
            console.log(memberSocketId);
            console.log(roomSockets);
            console.log(roomSockets.has(memberSocketId));
            if (!isInRoom) {
                // increment Redis notification counter per user/conversation
                await RedisService.incrNotification(member.email, message.conversationID, 1);
                if (memberSocketId) {
                    socket.to(memberSocketId).emit('publish message', message);
                    // push updated notifications map for that user:
                    const notifications = await RedisService.getNotifications(member.email);
                    io.to(memberSocketId).emit('notifications update', notifications);
                }
            }
        }
    }
}

async function handleDeleteMessage(io, socket, message) {
    const room = `chat_room_${message?.conversationID}`;
    io.emit('delete message', message);
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

async function handleLeaveRoom(body, socket) {
    const room = `chat_room_${body.conversationId}`;
    socket.leave(room);
}

async function handleDisconnect(io, email) {
    await RedisService.deleteUserSocket(email);
    await handleUpdateConnectedUsers(io);
}