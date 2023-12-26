const jwt = require('jsonwebtoken');
const jwtSecretKey = process.env.TOKEN_SECRET;

const guard = (requestOrSocket, response, next) => {
    // axios http req
    if (requestOrSocket?.headers?.authorization) {
        authToken = requestOrSocket.headers.authorization.split(' ')[1];
    } else {
        // socket req
        if (requestOrSocket?.auth?.token)
            authToken = requestOrSocket.auth.token;
        else {
            // Missing token
            return response ? response.status(401).json({ error: 'Authentication error: Token missing' }) :
                next(new Error('Authentication error: Token missing'));
        }
    }

    try {
        const verified = jwt.verify(authToken, jwtSecretKey);
        if (verified) {
            requestOrSocket.user = verified;
            return next();
        } else {
            // Invalid token
            return response ? response.status(401).json({ error: 'Authentication error: Invalid token' }) :
                next(new Error('Authentication error: Invalid token'));
        }
    } catch (error) {
        // Invalid token
        return response ? response.status(401).json({ error: 'Authentication error: Invalid token' }) :
            next(new Error('Authentication error: Invalid token'));
    }
};

module.exports = guard;