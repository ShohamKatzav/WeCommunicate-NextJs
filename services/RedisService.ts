import { Redis } from '@upstash/redis';

export default class RedisService {
    private static instance: Redis | null = null;

    private constructor() { }

    private static normalizeEmail(email?: string | null): string {
        if (!email || typeof email !== 'string') {
            console.warn('Invalid email provided to normalizeEmail');
            return "";
        }
        return email.trim().toLowerCase();
    }

    static getInstance(): Redis {
        if (!RedisService.instance) {
            RedisService.instance = Redis.fromEnv();
        }
        return RedisService.instance;
    }

    static async getUserSocketByEmail(email: string): Promise<string | null> {
        if (!email || typeof email !== 'string') {
            console.warn('Invalid email provided to getUserSocketByEmail');
            return null;
        }

        if (!RedisService.instance) {
            throw new Error('Redis instance not initialized');
        }
        const normalizedEmail = RedisService.normalizeEmail(email);
        try {
            const socketId = await RedisService.instance.hget('user_sockets', normalizedEmail!) as string;
            if (!socketId) {
                console.debug(`No socket found for email: ${normalizedEmail}`);
            }

            return socketId || null;
        } catch (error) {
            console.error(`Error getting socket for email ${email}:`, error);
            return null;
        }
    }

    static async addUserSocket(email: string, socketId: string) {
        if (!email || typeof email !== 'string' || !socketId || typeof socketId !== 'string') {
            console.warn('Invalid email provided to addUserSucket');
            return null;
        }
        if (!RedisService.instance) {
            throw new Error('Redis instance not initialized');
        }
        try {
            const normalizedEmail: string = RedisService.normalizeEmail(email);
            await RedisService.instance.hset("user_sockets", { [normalizedEmail]: socketId });
        } catch (error) {
            console.error('Error deleting user socket:', error);
            return null;
        }
    }

    static async deleteUser(email: string) {
        if (!email || typeof email !== 'string') {
            console.warn('Invalid email provided to deleteUser');
            return null;
        }
        if (!RedisService.instance) {
            throw new Error('Redis instance not initialized');
        }
        try {
            await RedisService.instance.hdel("user_sockets", email);
        } catch (error) {
            console.error('Error deleting user socket:', error);
            return null;
        }
    }

    static async getUsers() {
        if (!RedisService.instance) {
            throw new Error('Redis instance not initialized');
        }
        try {
            const allUsersRaw = await RedisService.instance.hgetall("user_sockets");
            if (allUsersRaw) {
                // Convert Redis hash → array of ChatUser-like objects
                const allUsers = Object.entries(allUsersRaw).map(([email, socketId]) => ({
                    email,
                    socketId,
                }));
                return allUsers;
            }
        } catch (error) {
            console.error('Error getting users socket:', error);
            return null;
        }
    }

    // increment notification count for a user/conversation (safe for Upstash)
    static async incrNotification(recieverEmail: string, conversationId: string, by = 1) {

        if (!recieverEmail || typeof recieverEmail !== 'string' || !conversationId || typeof conversationId !== 'string') {
            console.warn('Invalid input provided to incrNotification');
            return null;
        }
        if (!RedisService.instance) {
            throw new Error('Redis instance not initialized');
        }
        const norm = this.normalizeEmail(recieverEmail);
        if (!norm || !conversationId) return 0;
        const key = `notifications:${norm}`;

        try {
            const next = await RedisService.instance.hincrby(key, conversationId, by);
            return next;
        } catch (error) {
            console.error('Error incrNotification:', error);
            return null;
        }
    }
    // get all notifications for a user -> returns { conversationId: count, ... }
    static async getNotifications(recieverEmail: string): Promise<Record<string, number> | null> {
        if (!recieverEmail || typeof recieverEmail !== 'string') {
            console.warn('Invalid input provided to getNotifications');
            return null;
        }
        if (!RedisService.instance) {
            throw new Error('Redis instance not initialized');
        }
        const norm = this.normalizeEmail(recieverEmail);
        const key = `notifications:${norm}`;
        try {
            const data = await RedisService.instance.hgetall(key) || {};
            const out: Record<string, number> = {};
            for (const [field, val] of Object.entries(data)) {
                out[field] = Number(val);
            }
            return out;
        } catch (error) {
            console.error('Error getNotifications:', error);
            return null;
        }
    }

    // clear one conversation notification for a user
    static async clearNotification(recieverEmail: string, conversationId: string) {
        if (!recieverEmail || typeof recieverEmail !== 'string' || !conversationId || typeof conversationId !== 'string') {
            console.warn('Invalid input provided to incrNotification');
            return null;
        }
        if (!RedisService.instance) {
            throw new Error('Redis instance not initialized');
        }
        const norm = this.normalizeEmail(recieverEmail);
        const key = `notifications:${norm}`;
        try {
            await RedisService.instance.hdel(key, conversationId);
        } catch (error) {
            console.error('Error clearNotification:', error);
            return null;
        }
    }

}