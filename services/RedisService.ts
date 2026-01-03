import { Redis } from '@upstash/redis';
import OTP from '@/types/OTP';

export default class RedisService {
    private static instance: Redis | null = null;

    private static redis(): Redis {
        if (!this.instance) {
            this.instance = Redis.fromEnv();
        }
        return this.instance;
    }

    private static normalizeEmail(email?: string | null): string {
        if (!email || typeof email !== 'string') return '';
        return email.trim().toLowerCase();
    }
    private static socketKey(email: string) {
        return `user_sockets:${this.normalizeEmail(email)}`;
    }

    static async addUserSocket(email: string, socketId: string) {
        if (!email || !socketId) return;
        await this.redis().sadd(this.socketKey(email), socketId);
    }

    static async removeUserSocket(email: string, socketId: string) {
        if (!email || !socketId) return;
        await this.redis().srem(this.socketKey(email), socketId);
    }

    static async getUserSocketsByEmail(email: string): Promise<string[]> {
        if (!email) return [];
        return await this.redis().smembers(this.socketKey(email));
    }

    static async getUserPrimarySocket(email: string): Promise<string | null> {
        const sockets = await this.getUserSocketsByEmail(email);
        return sockets.length ? sockets[0] : null;
    }

    static async getOnlineUsers(): Promise<{ email: string; sockets: string[] }[]> {
        const keys = await this.redis().keys('user_sockets:*');
        const users: { email: string; sockets: string[] }[] = [];

        for (const key of keys) {
            const sockets = await this.redis().smembers(key);
            if (sockets.length > 0) {
                users.push({
                    email: key.replace('user_sockets:', ''),
                    sockets
                });
            }
        }
        return users;
    }


    private static notificationKey(email: string) {
        return `notifications:${this.normalizeEmail(email)}`;
    }

    static async incrNotification(email: string, conversationId: string, by = 1) {
        if (!email || !conversationId) return;
        return await this.redis().hincrby(
            this.notificationKey(email),
            conversationId,
            by
        );
    }

    static async getNotifications(email: string): Promise<Record<string, number>> {
        if (!email) return {};
        const raw = await this.redis().hgetall(this.notificationKey(email));
        const out: Record<string, number> = {};
        for (const [k, v] of Object.entries(raw ?? {})) {
            out[k] = Number(v);
        }
        return out;
    }

    static async clearNotification(email: string, conversationId: string) {
        if (!email || !conversationId) return;
        await this.redis().hdel(this.notificationKey(email), conversationId);
    }

    static async clearAllNotifications(email: string) {
        if (!email) return;
        await this.redis().del(this.notificationKey(email));
    }


    static async getOTPByEmail(email: string): Promise<OTP | null> {
        if (!email) return null;
        return await this.redis().hget('otp', this.normalizeEmail(email)) as OTP;
    }

    static async addOTP(email: string, otp: OTP) {
        if (!email || !otp?.OTP || !otp?.expiresAt) return;
        await this.redis().hset('otp', {
            [this.normalizeEmail(email)]: otp
        });
    }

    static async deleteOTP(email: string) {
        if (!email) return;
        await this.redis().hdel('otp', this.normalizeEmail(email));
    }
}