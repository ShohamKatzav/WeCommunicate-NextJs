import { env } from '@/app/config/env';
import RedisService from '@/services/RedisService';
import ModerationService from '@/services/ModerationService';
import jwt from 'jsonwebtoken';

export default async function authMiddleware(socket, next) {
    // This is only used to clean up Redis if the handshake fails before we
    // have a verified identity - it must never be trusted for anything else.
    const claimedEmail = socket.handshake.headers?.email;
    const token = 'token' in socket.handshake.auth ? socket.handshake.auth.token?.toString() : "";

    if (!token) {
        await RedisService.removeUserSocket(claimedEmail, socket.id);
        socket.emit("unauthorized");
        socket.disconnect(true);
        return next(new Error("No token found"));
    }

    let decoded;
    try {
        decoded = jwt.verify(token, env.JWT_SECRET_KEY);
    } catch (err) {
        await RedisService.removeUserSocket(claimedEmail, socket.id);
        socket.emit("unauthorized");
        socket.disconnect(true);
        return next(new Error("Invalid token"));
    }

    const banStatus = await ModerationService.isUserBanned(decoded._id);
    if (banStatus.isBanned) {
        socket.emit("banned", {
            reason: banStatus.reason,
            bannedUntil: banStatus.bannedUntil
        });
        socket.disconnect(true);
        return next(new Error("User is banned"));
    }

    // Everything downstream must use the identity from the verified token,
    // never a client-supplied handshake header - otherwise any client could
    // set an arbitrary "email" header and act as another user.
    socket.data.email = decoded.email;
    socket.data.userId = decoded._id;

    next();
}
