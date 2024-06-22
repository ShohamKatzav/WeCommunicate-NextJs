import jwt from 'jsonwebtoken';
const jwtSecretKey = process.env.TOKEN_SECRET as jwt.Secret;

async function handler(requestOrSocket: RequestOrSocket) {
    let authToken: string = '';
    if ('headers' in requestOrSocket && typeof requestOrSocket?.headers?.get === 'function') {
        // HTTP request
        const authHeader = requestOrSocket.headers.get('authorization');
        if (authHeader) {
            authToken = authHeader.split(' ')[1];

        } else {
            if ('handshake' in requestOrSocket)
                authToken = requestOrSocket?.handshake?.auth?.token! as string;
        }
    } else {
        // Token missing
        return false;
    }
    try {
        const verified = jwt.verify(authToken, jwtSecretKey);
        if (verified) {
            requestOrSocket.user = verified as string;
            return true;
        }
        // Invalid token
        return false;
    } catch (error) {
        // Invalid token
        return false;
    }
};

export default handler;