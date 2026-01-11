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

        return decoded.isModerator === true;
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

export async function banUser(userEmail: string) {
    try {
        const isModerator = await verifyModeratorAccess();
        if (!isModerator) {
            return { success: false, message: "Unauthorized" };
        }
        await connectDB();
        await AccountRepository.updateBanStatus(userEmail, true);
        return { success: true, message: "User banned successfully", userEmail };
    } catch (err) {
        console.error('Failed to ban user:', err);
        return { success: false, message: "Failed to ban user" };
    }
}

export async function unbanUser(userEmail: string) {
    try {
        const isModerator = await verifyModeratorAccess();
        if (!isModerator) {
            return { success: false, message: "Unauthorized" };
        }

        await connectDB();
        await AccountRepository.updateBanStatus(userEmail, false);
        return { success: true, message: "User unbanned successfully", userEmail };
    } catch (err) {
        console.error('Failed to unban user:', err);
        return { success: false, message: "Failed to unban user" };
    }
}

export async function promoteToModerator(userEmail: string) {
    const isModerator = await verifyModeratorAccess();
    if (!isModerator) {
        return { success: false, message: "Unauthorized" };
    }

    await connectDB();
    await AccountRepository.updateModeratorStatus(userEmail, true);
    return { success: true, message: "User promoted to moderator" };
}

export async function demoteFromModerator(userEmail: string) {
    try {
        const isModerator = await verifyModeratorAccess();
        if (!isModerator) {
            return { success: false, message: "Unauthorized" };
        }
        await connectDB();
        await AccountRepository.updateModeratorStatus(userEmail, false);
        return { success: true, message: "Moderator privileges revoked" };
    } catch (err) {
        console.error('Failed to demote user:', err);
        return { success: false, message: "Failed to demote user" };
    }
}