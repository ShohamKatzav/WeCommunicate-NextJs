import RedisService from '@/services/RedisService';
import { GetLocations, SaveLocations } from "@/app/lib/locationActions";
import Conversation from '@/models/Conversation'

export default async function handleSocketConnection(io, socket) {
    const email = socket.handshake.headers?.email;
    const conversationId = socket.handshake.headers?.conversationid;

    try {
        RedisService.getInstance();
        await RedisService.addUserSocket(email, socket.id);
        const allUsers = await RedisService.getUsers();
        io.emit('update connected users', allUsers);
        socket.on('update connected users', () => handleUpdateConnectedUsers(io));

        if (conversationId) {
            const room = `chat_room_${conversationId}`;
            socket.join(room);
        }

        socket.on('save location', (location) => handleSaveLocation(io, socket, location));
        socket.on('get locations', () => handleGetLocation(io, socket));
        socket.on('notifications update', () => handleNotificationsUpdate(socket, email));
        socket.on("notifications checked", (roomID) => handleNotificationsChecked(roomID, email));
        socket.on('chat message', (message) => handleChatMessage(io, message));
        socket.on('join room', (body) => handleJoinRoom(body, socket));
        socket.on('leave room', (body) => handleLeaveRoom(body, socket));
        socket.on('disconnect', () => handleDisconnect(io, email));

    }
    catch (error) {
        console.error('Socket connection error:', error);
        socket.disconnect(true);
    }
}

async function handleUpdateConnectedUsers(io) {
    const fresh = await RedisService.getUsers();
    io.emit('update connected users', fresh);
}

async function handleGetLocation(io, socket) {
    const positions = await GetLocations();
    io.to(socket.id).emit('get locations', positions);
}

async function handleSaveLocation(io, socket, location) {
    await SaveLocations(location);
    await handleGetLocation(io, socket);
}

async function handleNotificationsUpdate(socket, email) {
    const notifications = await RedisService.getNotifications(email);
    socket.emit("notifications update", notifications);
}

async function handleNotificationsChecked(roomID, email) {
    await RedisService.clearNotification(email, roomID);
}

async function handleChatMessage(io, message) {

    const room = `chat_room_${message?.conversationID}`;
    io.to(room).emit('chat message', message);

    // Handle notifications
    const conversation = await Conversation.findById(message.conversationID).populate('members', 'email');

    if (conversation) {
        for (const member of conversation.members) {
            if (member.email.toUpperCase() === message.sender.toUpperCase()) continue;
            const memberSocketId = await RedisService.getUserSocketByEmail(member.email);
            const roomSockets = await io.in(room).allSockets();
            const isInRoom = memberSocketId && roomSockets.has(memberSocketId);

            if (!isInRoom) {
                // increment Redis notification counter per user/conversation
                await RedisService.incrNotification(member.email, message.conversationID, 1);

                if (memberSocketId) {
                    io.to(memberSocketId).emit('chat message', message);
                    // push updated notifications map for that user:
                    const notifications = await RedisService.getNotifications(member.email);
                    io.to(memberSocketId).emit('notifications update', notifications);
                }
            }
        }
    }
}

async function handleJoinRoom(body, socket) {
    const room = `chat_room_${body.conversationId}`;
    socket.join(room);
}

async function handleLeaveRoom(body, socket) {
    const room = `chat_room_${body.conversationId}`;
    socket.leave(room);
}

async function handleDisconnect(io, email) {
    await RedisService.deleteUser(email);
    await handleUpdateConnectedUsers(io);
}