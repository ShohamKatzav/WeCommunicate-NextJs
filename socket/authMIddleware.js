import RedisService from '@/services/RedisService'
import jwt from 'jsonwebtoken';
const jwtSecretKey = process.env.TOKEN_SECRET;

if (!jwtSecretKey) {
    throw new Error("TOKEN_SECRET environment variable is not set");
}

export default async function authMiddleware(socket, next) {
    const email = socket.handshake.headers?.email;
    let token = "";

    if ('token' in socket.handshake.auth) {
        token = socket.handshake.auth.token.toString();
    }
    else {
        RedisService.getInstance();
        await RedisService.deleteUser(email);
        socket.emit("unauthorized");
        socket.disconnect(true);
        next(new Error("No token found"));
    }

    try {
        jwt.verify(token, jwtSecretKey);
    } catch (err) {
        await RedisService.deleteUser(email);
        socket.emit("unauthorized");
        socket.disconnect(true);
        next(new Error("Invalid token"));
    }
    next();

}