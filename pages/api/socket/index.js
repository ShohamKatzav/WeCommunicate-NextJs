import { Server } from 'socket.io';
import handleSocketConnection from '@/socket/handlers';
import authMiddleware from '@/socket/authMIddleware'
import rateLimitMiddleware from '@/socket/rateLimitMiddleware'

let io = null;

export default async function handler(req, res) {
    if (res.socket.server.io) {
        console.log('Socket already initialized');
        res.end();
    }

    if (!io)
        io = new Server(res.socket.server, {
            path: "/api/socket",
            connectionStateRecovery: {
                maxDisconnectionDuration: 2 * 60 * 1000,
                skipMiddlewares: true,
            },
            cors: {
                origin: ["http://localhost:3000", "https://we-communicate.vercel.app"],
                methods: ["GET", "POST"],
            },
            addTrailingSlash: false,
        });

    io.use(rateLimitMiddleware);
    io.use(authMiddleware);
    io.on('connection', (socket) => handleSocketConnection(io, socket));

    res.socket.server.io = io;
    res.end();
}