import { Server } from "socket.io";
import guard from "@/app/api/guards/guard";
import { GetLocations, SaveLocations } from "@/app/api/location/locations";
import Conversation from '@/app/api/models/Conversation'

const connectedUsers = [];
const notifications = {};

const ioHandler = (req, res) => {
    if (!res.socket.server.io) {
        const io = new Server(res.socket.server, {
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

        const verified = guard(req.socket);
        if (!verified) return new Error("Authentication error");

        io.on('connection', (socket) => {
            const { email, conversationId } = socket.handshake.headers;

            const existingUserIndex = connectedUsers.findIndex(
                user => (user.email.toUpperCase() === email?.toUpperCase()));

            if (existingUserIndex !== -1) {
                // Update the socketId if the user is already connected
                connectedUsers[existingUserIndex].socketId = socket.id;
            } else {
                // Add a new user if they are not already connected
                const newUser = { socketId: socket.id, email, conversationId };
                connectedUsers.push(newUser);
            }

            io.emit('update users', connectedUsers);

            if (notifications[email]) {
                io.emit('notifications update');
            }

            //GET
            socket.on("notifications update", async () => {
                io.to(socket.id).emit("notifications update", notifications[email]);
            });

            //SET
            socket.on("update notifications count", async (unreadMessages) => {
                if (unreadMessages && email)
                    for (const [sender, count] of Object.entries(unreadMessages)) {
                        if (notifications[email] === undefined)
                            notifications[email] = {};
                        notifications[email][sender.toUpperCase()] = Number(count);
                    }
            });

            //DELETE
            socket.on("notifications checked", async (sender) => {
                if (sender && email) {
                    if (notifications[email] !== undefined && notifications[email][sender.toUpperCase()] !== undefined)
                        delete notifications[email][sender.upperCaseSender];
                }
            });

            // 3 cases:
            // 1 - User connected and in the room - chats messages updated
            // 2 - User connected but not in the room - chats message event will create notification
            // 3 - User disconnected - we'll store notification update for the users next connection
            socket.on('chat message', async (message) => {

                //1
                const room = `chat_room_${message.conversationID}`;
                io.to(room).emit('chat message', message);
                const roomies = io.sockets.adapter.rooms.get(room);
                if (roomies) {
                    const socketIds = Array.from(roomies);
                    const connectedRecipient = connectedUsers.find(
                        user => user.email.toUpperCase() !== message.sender.toUpperCase()
                    );
                    //2
                    if (connectedRecipient) {
                        const recipientSocketId = connectedRecipient.socketId;
                        const isInRoom = socketIds.includes(recipientSocketId);
                        if (!isInRoom) {
                            io.to(recipientSocketId).emit('chat message', message);
                            const AsName = connectedRecipient?.email.charAt(0).toUpperCase() + connectedRecipient?.email.slice(1);
                            initializeNotificationKey(AsName, message);
                            ++notifications[AsName][message.sender.toUpperCase()];
                        }
                    }
                    //3
                    if (!connectedRecipient) {
                        // Fetch from MongoDB only if the recipient isn't connected
                        const conversation = await Conversation.findById(message.conversationID).populate('members', 'email');
                        if (!conversation) return;

                        const recipient = conversation.members.find(
                            member => member.email.toUpperCase() !== message.sender.toUpperCase()
                        );

                        if (recipient) {
                            const AsName = recipient.email.charAt(0).toUpperCase() + recipient.email.slice(1);
                            initializeNotificationKey(AsName, message);
                            ++notifications[AsName][message.sender.toUpperCase()];
                        }
                    }
                }

            });

            socket.on('save location', async (location) => {
                await SaveLocations(location);
                const positions = await GetLocations();
                io.to(socket.id).emit('get locations', positions);
            });

            socket.on('get locations', async () => {
                const positions = await GetLocations();
                io.to(socket.id).emit('get locations', positions);
            });

            socket.on('get connected users', () => {
                io.to(socket.id).emit('get connected users', connectedUsers.filter(user => user.conversationId === conversationId));
            });

            socket.on('join room', (body) => {
                const room = `chat_room_${body.conversationId}`;
                socket.join(room);
            });

            socket.on('leave room', (body) => {
                const room = `chat_room_${body.conversationId}`;
                socket.leave(room);
            });


            socket.on('disconnect', () => {
                const userIndex = connectedUsers.findIndex(user => user.socketId === socket.id);
                if (userIndex !== -1) {
                    connectedUsers.splice(userIndex, 1);
                }
            });
        });

        res.socket.server.io = io;
    }
    res.end();
};

const initializeNotificationKey = (recieverEmail, message) => {
    if (!notifications[recieverEmail]) {
        notifications[recieverEmail] = {};
    }
    if (!notifications[recieverEmail][message.sender.toUpperCase()]) {
        notifications[recieverEmail][message.sender.toUpperCase()] = 0;
    }
}

export default ioHandler;