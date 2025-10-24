import { Redis } from '@upstash/redis';

export default class RedisService {
    private static instance: Redis | null = null;

    private constructor() { }

    private static normalizeEmail(email?: string | null) {
        return email ? email[0].toUpperCase() + email.slice(1) : null;
    }

    static getInstance(): Redis {
        if (!RedisService.instance) {
            RedisService.instance = Redis.fromEnv();
        }
        return RedisService.instance;
    }

    static async deleteUser(email: string) {
        if (email) {
            await RedisService.instance?.hdel("user_sockets", email);
        }
    }

    static async getUsers() {
        const redis = RedisService.getInstance();
        const allUsersRaw = await redis.hgetall("user_sockets");
        if (allUsersRaw) {
            // Convert Redis hash → array of ChatUser-like objects
            const allUsers = Object.entries(allUsersRaw).map(([email, socketId]) => ({
                email,
                socketId,          // string from redis
            }));
            return allUsers;
        }
        return null;
    }

    // increment notification count for a user/conversation (safe for Upstash)
    static async incrNotification(recieverEmail: string, conversationId: string, by = 1) {
        const norm = this.normalizeEmail(recieverEmail);
        if (!norm || !conversationId) return 0;
        const redis = RedisService.getInstance();
        const key = `notifications:${norm}`;

        // read current value and write back incremented (Upstash may not have hincrby)
        const currentRaw = await redis.hget(key, conversationId);
        const current = currentRaw == null ? 0 : Number(currentRaw);
        const next = current + by;
        await redis.hset(key, { [conversationId]: String(next) });
        return next;
    }

    // get all notifications for a user -> returns { conversationId: count, ... }
    static async getNotifications(recieverEmail: string): Promise<Record<string, number>> {
        const norm = this.normalizeEmail(recieverEmail);
        if (!norm) return {};
        const redis = RedisService.getInstance();
        const key = `notifications:${norm}`;
        const data = await redis.hgetall(key) || {};
        const out: Record<string, number> = {};
        for (const [field, val] of Object.entries(data)) {
            out[field] = Number(val);
        }
        return out;
    }

    // clear one conversation notification for a user
    static async clearNotification(recieverEmail: string, conversationId: string) {
        const norm = this.normalizeEmail(recieverEmail);
        if (!norm || !conversationId) return;
        const redis = RedisService.getInstance();
        const key = `notifications:${norm}`;
        await redis.hdel(key, conversationId);
    }

}