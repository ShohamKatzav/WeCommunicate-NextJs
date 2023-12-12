const jwt = require('jsonwebtoken');
const jwtSecretKey = process.env.TOKEN_SECRET;

const guard = (socket, next) => {
    const authToken = socket.handshake.auth.token;

    // Perform authentication logic here
    if (!authToken) {
        return next(new Error('Authentication error: Token missing'));
    }

    try {
        const verified = jwt.verify(authToken, jwtSecretKey);
        if (verified) {
            socket.user = verified;
            return next();  // Call next without an error to proceed
        } else {
            // Access Denied
            return next(new Error('Authentication error: Invalid token'));
        }
    } catch (error) {
        // Access Denied
        return next(new Error('Authentication error: Invalid token'));
    }
};

const Chat = (io) => (socket) => {
    guard(socket, (error) => {
        if (error) {
            console.error(error.message);
            socket.disconnect(true); // Disconnect the socket in case of authentication error
        } else {
            console.log(`${socket.id} connected`);
            socket.on('chat message', (message) => {
                io.emit('chat message', message); // Broadcast the message to all connected clients
            });
            
            socket.on('disconnect', () => {
                console.log(`${socket.id} disconnected`);
            });
        }
    });
};


module.exports = Chat;