import connectDB from "@/app/lib/MongoDb";
import AccountRepository from "@/repositories/AccountRepository";
import bcrypt from 'bcryptjs';
import { isPhone, normalizePhone } from './contact';

// Plain server-only helpers (no "use server" directive) shared between
// accountActions.ts and OTPActions.ts. Because this file is not a server
// action module, nothing exported here is directly callable from the
// client - only reachable through the actions that import it, which is
// what keeps password updates gated behind OTP verification.

export async function findAccount(identifier: string) {
    return isPhone(identifier)
        ? AccountRepository.getUserByPhone(normalizePhone(identifier))
        : AccountRepository.getUserByEmail(identifier.trim().toLowerCase());
}

export async function updateAccountPassword(identifier: string, newPassword: string) {
    await connectDB();
    const user = await findAccount(identifier);
    if (!user) return { message: 'Account not found', status: 404 };
    await AccountRepository.updatePassword(user.email, await bcrypt.hash(newPassword, 10));
    return { success: true, status: 201 };
}
