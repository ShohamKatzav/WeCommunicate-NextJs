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
                origin: process.env.NODE_ENV === 'production'
                    ? ["https://wecommunicate-nextjs.onrender.com"]
                    : true,
                methods: ["GET", "POST"],
                credentials: true,
                addTrailingSlash: false,
            }
        });

    io.use(rateLimitMiddleware);
    io.use(authMiddleware);
    io.on('connection', (socket) => handleSocketConnection(io, socket));

    res.socket.server.io = io;
    res.end();
}