import { Server } from 'socket.io';
import handleSocketConnection from '@/socket/handlers';
import authMiddleware from '@/socket/authMIddleware'
import rateLimitMiddleware from '@/socket/rateLimitMiddleware'
import AccountRepository from '@/repositories/AccountRepository'

let io = null;
let banCheckInterval = null;

async function checkExpiredBans(io) {
    try {
        const now = new Date();
        const expiredBans = await AccountRepository.getExpiredBans(now);

        if (expiredBans.length > 0) {
            await AccountRepository.updateExpiredBans(now);
            const moderators = await Account.find({ isModerator: true }).select('email');

            for (const mod of moderators) {
                const socketIds = await RedisService.getUserSocketsByEmail(mod.email);
                socketIds.forEach(socketId => {
                    io.to(socketId).emit('update_ban_expire',
                        { userEmails: expiredBans.map(u => u.email) }
                    );
                });
            }
        }
    } catch (error) {
        console.error('Error checking expired bans:', error);
    }
}

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
    // We'll check unbanned users every 3 minutes - same interval for everyone
    io.on('connection', (socket) => handleSocketConnection(io, socket));
    if (!banCheckInterval) {
        banCheckInterval = setInterval(() => checkExpiredBans(io), 180000);
    }

    res.socket.server.io = io;
    res.end();
}