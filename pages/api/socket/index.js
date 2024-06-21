import { Server } from "socket.io";
import guard from "@/app/api/guards/guard";
import GetLocations from "@/app/api/location/get-locations/route";
import SaveLocations from "@/app/api/location/save-location/route";

const connectedUsers = [];

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

        // Listen for connection events
        io.on('connection', (socket) => {
            socket.join('chat room');
            connectedUsers.push({ id: socket.id, email: socket.handshake.headers.email });
            io.to('chat room').emit('update users', connectedUsers);

            socket.on('chat message', (message) => {
                io.to('chat room').emit('chat message', message); // Broadcast the message to all connected clients
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
                io.to(socket.id).emit('get connected users', connectedUsers);
            });

            socket.on('disconnect', () => {
                const userIndex = connectedUsers.findIndex(user => user.id === socket.id);
                if (userIndex !== -1) {
                    connectedUsers.splice(userIndex, 1);
                    io.to('chat room').emit('update users', connectedUsers);
                }
            });
        });
        res.socket.server.io = io;
    }
    res.end();
};

export default ioHandler;