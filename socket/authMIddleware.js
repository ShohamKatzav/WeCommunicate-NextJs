import { env } from '@/app/config/env';
import RedisService from '@/services/RedisService';
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
        jwt.verify(token, env.JWT_SECRET_KEY);
    } catch (err) {
        await RedisService.removeUserSocket(email, socket.id);
        socket.emit("unauthorized");
        socket.disconnect(true);
        next(new Error("Invalid token"));
    }
    next();

}