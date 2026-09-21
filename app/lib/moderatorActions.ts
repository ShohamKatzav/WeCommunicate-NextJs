"use server"
import { env } from '@/app/config/env';
import connectDB from "@/app/lib/MongoDb";
import AccountRepository from "@/repositories/AccountRepository";
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

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
    try {
        const isModerator = await verifyModeratorAccess();
        if (!isModerator) {
            return { success: false, message: "Unauthorized", users: [] };
        }
        await connectDB();

        const now = new Date();
        await AccountRepository.updateExpiredBans(now);

        const users = await AccountRepository.getAllUsersWithStatus();
        return JSON.parse(JSON.stringify({ success: true, users }));
    } catch (err) {
        console.error('Failed to get users:', err);
        return { success: false, message: "Failed to fetch users", users: [] };
    }
}

export async function banUser(userId: string) {
    try {
        const isModerator = await verifyModeratorAccess();
        if (!isModerator) {
            return { success: false, message: "Unauthorized" };
        }
        await connectDB();
        const account = await AccountRepository.updateBanStatusById(userId, true) as { email?: string } | null;
        if (!account) return { success: false, message: "User not found" };
        return { success: true, message: "User banned successfully", userEmail: account.email ?? null };
    } catch (err) {
        console.error('Failed to ban user:', err);
        return { success: false, message: "Failed to ban user" };
    }
}

export async function unbanUser(userId: string) {
    try {
        const isModerator = await verifyModeratorAccess();
        if (!isModerator) {
            return { success: false, message: "Unauthorized" };
        }

        await connectDB();
        const account = await AccountRepository.updateBanStatusById(userId, false) as { email?: string } | null;
        if (!account) return { success: false, message: "User not found" };
        return { success: true, message: "User unbanned successfully", userEmail: account.email ?? null };
    } catch (err) {
        console.error('Failed to unban user:', err);
        return { success: false, message: "Failed to unban user" };
    }
}

export async function promoteToModerator(userId: string) {
    try {
        const isModerator = await verifyModeratorAccess();
        if (!isModerator) {
            return { success: false, message: "Unauthorized" };
        }

        await connectDB();
        const account = await AccountRepository.updateModeratorStatusById(userId, true);
        if (!account) return { success: false, message: "User not found" };
        return { success: true, message: "User promoted to moderator" };
    } catch (err) {
        console.error('Failed to promote user:', err);
        return { success: false, message: "Failed to promote user" };
    }
}

export async function demoteFromModerator(userId: string) {
    try {
        const isModerator = await verifyModeratorAccess();
        if (!isModerator) {
            return { success: false, message: "Unauthorized" };
        }
        await connectDB();
        const account = await AccountRepository.updateModeratorStatusById(userId, false);
        if (!account) return { success: false, message: "User not found" };
        return { success: true, message: "Moderator privileges revoked" };
    } catch (err) {
        console.error('Failed to demote user:', err);
        return { success: false, message: "Failed to demote user" };
    }
}