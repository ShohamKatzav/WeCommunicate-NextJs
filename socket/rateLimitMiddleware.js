const connectionAttempts = new Map();

export default function rateLimitMiddleware(socket, next) {

    if (process.env.NODE_ENV === 'test' || process.env.E2E_TEST === 'true') {
        return next();
    }

    const bypassSecret = socket.handshake.headers['x-bypass-ratelimit'];
    if (process.env.TEST_BYPASS_KEY && bypassSecret === process.env.TEST_BYPASS_KEY) {
        return next();
    }

    const ip = socket.handshake.address;

    const isLocalhost = ip === '127.0.0.1' ||
        ip === '::1' ||
        ip === '::ffff:127.0.0.1';

    if (isLocalhost && process.env.NODE_ENV !== 'production') {
        return next();
    }

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