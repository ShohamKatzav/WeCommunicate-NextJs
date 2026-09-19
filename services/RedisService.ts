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
        const key = this.socketKey(email);
        await this.redis().sadd(key, socketId);
        // Without a TTL, a missed disconnect event (server restart, crashed
        // process, etc.) leaves a socket id in this set forever, and that
        // user shows as permanently online. Bound the damage to at most a
        // day instead of indefinitely - a normal reconnect refreshes it well
        // before that.
        await this.redis().expire(key, 60 * 60 * 24);
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
        // Note: KEYS scans the whole keyspace and is not recommended at
        // scale - a proper fix means switching presence tracking to a
        // single sorted set (touching addUserSocket/removeUserSocket too),
        // which is out of scope for this pass. This at least stops doing
        // the per-key SMEMBERS lookups one at a time in sequence, which
        // was turning N keys into N sequential round-trip latencies.
        const keys = await this.redis().keys('user_sockets:*');
        if (keys.length === 0) return [];

        const socketsByKey = await Promise.all(keys.map(key => this.redis().smembers(key)));

        const users: { email: string; sockets: string[] }[] = [];
        keys.forEach((key, i) => {
            const sockets = socketsByKey[i];
            if (sockets.length > 0) {
                users.push({
                    email: key.replace('user_sockets:', ''),
                    sockets
                });
            }
        });
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


    private static otpKey(contact: string) {
        return `otp:${this.normalizeEmail(contact)}`;
    }
    private static otpAttemptsKey(contact: string) {
        return `otp_attempts:${this.normalizeEmail(contact)}`;
    }
    private static otpCooldownKey(contact: string) {
        return `otp_cooldown:${this.normalizeEmail(contact)}`;
    }

    static async getOTPByEmail(email: string): Promise<OTP | null> {
        if (!email) return null;
        return await this.redis().get(this.otpKey(email)) as OTP | null;
    }

    static async addOTP(email: string, otp: OTP) {
        if (!email || !otp?.OTP || !otp?.expiresAt) return;
        // Store each OTP under its own key with a TTL matching its expiry -
        // the previous single unbounded hash never dropped old codes, which
        // both wastes the Upstash free-tier quota forever and keeps stale
        // codes around indefinitely.
        const ttlSeconds = Math.max(1, Math.ceil((otp.expiresAt - Date.now()) / 1000));
        await this.redis().set(this.otpKey(email), otp, { ex: ttlSeconds });
    }

    static async deleteOTP(email: string) {
        if (!email) return;
        await this.redis().del(this.otpKey(email));
        await this.redis().del(this.otpAttemptsKey(email));
    }

    // Marks a send as having happened; returns false if one was already sent
    // within `cooldownSeconds`, so callers can refuse to send another.
    static async startOTPSendCooldown(email: string, cooldownSeconds = 60): Promise<boolean> {
        if (!email) return false;
        const result = await this.redis().set(this.otpCooldownKey(email), '1', {
            nx: true,
            ex: cooldownSeconds,
        });
        return result === 'OK';
    }

    // Increments the verification attempt counter for a contact and returns
    // the new count. The counter expires on its own after `windowSeconds` so
    // a lockout is temporary rather than permanent.
    static async incrOTPAttempts(email: string, windowSeconds = 900): Promise<number> {
        if (!email) return Infinity;
        const key = this.otpAttemptsKey(email);
        const count = await this.redis().incr(key);
        if (count === 1) {
            await this.redis().expire(key, windowSeconds);
        }
        return count;
    }

    // Tracks how many times the moderation API has failed and fallen open
    // (see ModerationService.moderateMessage) - no TTL, this is meant to
    // accumulate as a standing signal, not expire like a rate-limit counter.
    static async incrModerationFailure() {
        await this.redis().incr('moderation_failures_total');
    }

    // Generic fixed-window rate limiter for server actions (login attempts,
    // message sends, etc.). Returns true if the caller is still under the
    // limit for this window. `scope` namespaces independent limiters (e.g.
    // "login", "send-message") so the same identifier doesn't share a
    // counter across unrelated actions.
    static async checkRateLimit(scope: string, identifier: string, limit: number, windowSeconds: number): Promise<boolean> {
        if (!identifier) return false;
        const key = `ratelimit:${scope}:${this.normalizeEmail(identifier)}`;
        const count = await this.redis().incr(key);
        if (count === 1) {
            await this.redis().expire(key, windowSeconds);
        }
        return count <= limit;
    }
}