import { Server } from "socket.io";
import proxy from "@/proxy"
import { GetLocations, SaveLocations } from "@/app/api/location/locations";
import Conversation from '@/app/api/models/Conversation'
import RedisService from '@/services/RedisService'

let redis = null;
let io = null;

const ioHandler = async (req, res) => {
    if (!io) {
        io = new Server(res.socket.server, {
            path: "/api/socket/",
            connectionStateRecovery: {
                maxDisconnectionDuration: 2 * 60 * 1000,
                skipMiddlewares: true,
            },
            cors: {
                origin: ["http://localhost:3000", "https://we-communicate.vercel.app"],
                methods: ["GET", "POST"],
            },
        });

        redis = RedisService.getInstance();

        io.on('connection', async (socket) => {
            const authHeader = socket.handshake.auth;
            const email = socket.handshake.headers?.email;
            const conversationId = socket.handshake.headers?.conversationid;

            try {
                await proxy(authHeader);
            } catch (error) {
                // emit then disconnect and cleanup
                const emailFromEntry = socket.handshake?.headers?.email;
                await RedisService.deleteUser(emailFromEntry);
                socket.emit("unauthorized");
                socket.disconnect(true);
                return;
            }

            try {
                // === Store socket in redis on connection ===
                await RedisService.addUserSocket(email, socket.id);

                // emit fresh users list
                const allUsers = await RedisService.getUsers();
                io.emit('update connected users', allUsers);

                // allow client to request an up-to-date list (re-query on each request)
                socket.on('update connected users', async () => {
                    const fresh = await RedisService.getUsers();
                    io.emit('update connected users', fresh);
                });

                //=== Join room if provided ===
                if (conversationId) {
                    const room = `chat_room_${conversationId}`;
                    socket.join(room);
                }

                socket.on('save location', async (location) => {
                    await SaveLocations(location);
                    const positions = await GetLocations();
                    io.to(socket.id).emit('get locations', positions);
                });

                socket.on('get locations', async () => {
                    const positions = await GetLocations();
                    io.to(socket.id).emit('get locations', positions);
                });


                socket.on('notifications update', async () => {
                    const notifications = await RedisService.getNotifications(email);
                    socket.emit("notifications update", notifications);
                });

                socket.on("notifications checked", async (roomID) => {
                    await RedisService.clearNotification(email, roomID);
                });

                socket.on('chat message', async (message) => {
                    const room = `chat_room_${message.conversationID}`;
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
                });

                socket.on('join room', async (body) => {
                    const room = `chat_room_${body.conversationId}`;
                    socket.join(room);
                });

                socket.on('leave room', async (body) => {
                    const room = `chat_room_${body.conversationId}`;
                    socket.leave(room);
                });

                socket.on('disconnect', async () => {
                    try {
                        const emailFromEntry = socket.handshake?.headers?.email;
                        await RedisService.deleteUser(emailFromEntry);
                        const allUsers = await RedisService.getUsers();
                        io.emit('update connected users', allUsers);
                    } catch (err) {
                        console.error('Error during disconnect cleanup:', err);
                    }
                });

            } catch (error) {
                console.error('Socket connection error:', error);
                socket.disconnect(true);
            }
        });

        res.socket.server.io = io;
    }
    res.end();
};

export default ioHandler;