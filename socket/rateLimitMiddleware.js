const connectionAttempts = new Map();

export default function rateLimitMiddleware(socket, next) {
    const ip = socket.handshake.address;
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxAttempts = 10;

    if (!connectionAttempts.has(ip)) {
        connectionAttempts.set(ip, []);
    }

    const attempts = connectionAttempts.get(ip);

    // Remove old attempts outside the time window
    const recentAttempts = attempts.filter(time => now - time < windowMs);
    if (recentAttempts.length >= maxAttempts) {
        const error = new Error('Too many connection attempts');
        error.data = { code: 'RATE_LIMIT' };
        return next(error);
    }
    recentAttempts.push(now);
    connectionAttempts.set(ip, recentAttempts);

    next();
}