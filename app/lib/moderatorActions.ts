"use server"
import { env } from '@/app/config/env';
import connectDB from "@/app/lib/MongoDb";
import AccountRepository from "@/repositories/AccountRepository";
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { getT } from "@/app/i18n/server";

async function verifyModeratorAccess(): Promise<boolean> {
    try {
        const cookieStore = await cookies();
        const userCookie = await cookieStore.get("user");

        if (!userCookie) return false;

        const user = JSON.parse(userCookie.value);
        const decoded = jwt.verify(user.token, env.JWT_SECRET_KEY!) as any;

        // Re-check the live value in the DB rather than trusting the token's
        // isModerator claim - otherwise a session issued before a demotion
        // keeps working as a moderator until the token happens to expire.
        await connectDB();
        const account = await AccountRepository.getUserByID(decoded._id);
        return account?.isModerator === true;
    } catch {
        return false;
    }
}

export async function getAllUsers() {
    const t = await getT();
    try {
        const isModerator = await verifyModeratorAccess();
        if (!isModerator) {
            return { success: false, message: t('errors.unauthorized'), users: [] };
        }
        await connectDB();

        const now = new Date();
        await AccountRepository.updateExpiredBans(now);

        const users = await AccountRepository.getAllUsersWithStatus();
        return JSON.parse(JSON.stringify({ success: true, users }));
    } catch (err) {
        console.error('Failed to get users:', err);
        return { success: false, message: t('errors.fetchUsersFailed'), users: [] };
    }
}

export async function banUser(userId: string) {
    const t = await getT();
    try {
        const isModerator = await verifyModeratorAccess();
        if (!isModerator) {
            return { success: false, message: t('errors.unauthorized') };
        }
        await connectDB();
        const account = await AccountRepository.updateBanStatusById(userId, true) as { email?: string } | null;
        if (!account) return { success: false, message: t('errors.userNotFound') };
        return { success: true, message: t('errors.banned'), userEmail: account.email ?? null };
    } catch (err) {
        console.error('Failed to ban user:', err);
        return { success: false, message: t('errors.banFailed') };
    }
}

export async function unbanUser(userId: string) {
    const t = await getT();
    try {
        const isModerator = await verifyModeratorAccess();
        if (!isModerator) {
            return { success: false, message: t('errors.unauthorized') };
        }

        await connectDB();
        const account = await AccountRepository.updateBanStatusById(userId, false) as { email?: string } | null;
        if (!account) return { success: false, message: t('errors.userNotFound') };
        return { success: true, message: t('errors.unbanned'), userEmail: account.email ?? null };
    } catch (err) {
        console.error('Failed to unban user:', err);
        return { success: false, message: t('errors.unbanFailed') };
    }
}

export async function promoteToModerator(userId: string) {
    const t = await getT();
    try {
        const isModerator = await verifyModeratorAccess();
        if (!isModerator) {
            return { success: false, message: t('errors.unauthorized') };
        }

        await connectDB();
        const account = await AccountRepository.updateModeratorStatusById(userId, true) as { email?: string } | null;
        if (!account) return { success: false, message: t('errors.userNotFound') };
        // For the moderator page to tell the user's open tabs, the same way a
        // ban reaches them - see handleModeratorStatusChanged in socket/handlers.ts.
        return { success: true, message: t('errors.promoted'), userEmail: account.email ?? null };
    } catch (err) {
        console.error('Failed to promote user:', err);
        return { success: false, message: t('errors.promoteFailed') };
    }
}

export async function demoteFromModerator(userId: string) {
    const t = await getT();
    try {
        const isModerator = await verifyModeratorAccess();
        if (!isModerator) {
            return { success: false, message: t('errors.unauthorized') };
        }
        await connectDB();
        const account = await AccountRepository.updateModeratorStatusById(userId, false) as { email?: string } | null;
        if (!account) return { success: false, message: t('errors.userNotFound') };
        return { success: true, message: t('errors.demoted'), userEmail: account.email ?? null };
    } catch (err) {
        console.error('Failed to demote user:', err);
        return { success: false, message: t('errors.demoteFailed') };
    }
}