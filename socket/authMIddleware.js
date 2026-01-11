import { env } from '@/app/config/env';
import RedisService from '@/services/RedisService';
import ModerationService from '@/services/ModerationService';
import jwt from 'jsonwebtoken';

export default async function authMiddleware(socket, next) {
    const email = socket.handshake.headers?.email;
    let token = "";

    if ('token' in socket.handshake.auth) {
        token = socket.handshake.auth.token.toString();
    }
    else {
        await RedisService.removeUserSocket(email, socket.id);
        socket.emit("unauthorized");
        socket.disconnect(true);
        next(new Error("No token found"));
    }

    try {
        const decoded = jwt.verify(token, env.JWT_SECRET_KEY);
        const banStatus = await ModerationService.isUserBanned(decoded._id);
        if (banStatus.isBanned) {
            socket.emit("banned", {
                reason: banStatus.reason,
                bannedUntil: banStatus.bannedUntil
            });
            socket.disconnect(true);
            return next(new Error("User is banned"));
        }
    } catch (err) {
        await RedisService.removeUserSocket(email, socket.id);
        socket.emit("unauthorized");
        socket.disconnect(true);
        next(new Error("Invalid token"));
    }
    next();

}