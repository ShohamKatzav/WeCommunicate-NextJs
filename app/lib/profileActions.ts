"use server"
import { env } from "@/app/config/env";
import jwt from "jsonwebtoken";
import connectDB from "@/app/lib/MongoDb";
import AccountRepository from "@/repositories/AccountRepository";
import { isExist } from "@/app/lib/accountActions";
import Message from "@/models/Message";
import { extractUserIDFromCoockie } from "@/app/lib/cookieActions";
import { deleteFile } from "@/app/lib/fileActions";
import { requestOTP, verifyOTP, deleteOTP } from "@/app/lib/OTPActions";
import { isEmail, isPhone, normalizePhone } from "@/app/lib/contact";
import { ABOUT_MAX_LENGTH, ACCENT_COLORS } from "@/app/config/limits";
import { revalidatePath } from "next/cache";

const INVALID_PHONE_MESSAGE = 'Use an international phone number, e.g. +972 50 123 4567';
const NO_EMAIL_ON_FILE_MESSAGE = "Phone number changes are verified by email, and this account doesn't have one on file.";
const INVALID_EMAIL_MESSAGE = 'Enter a valid email address';
const EMAIL_TAKEN_MESSAGE = 'This email address is already associated with another account.';

// Phone changes are only offered to accounts with a real email address - see
// PhoneNumberEditor.tsx and NO_EMAIL_ON_FILE_MESSAGE above for why (phone-only
// signups store a synthetic `phone:...` key as their `email`, which isn't
// reachable to verify a change against - see accountActions.ts's createUser).
async function getOwnEmailForPhoneChange(userID: string) {
    const account = await AccountRepository.getProfileByIdentifier(userID) as { email?: string } | null;
    return account?.email && isEmail(account.email) ? account.email : null;
}

export const getProfile = async (identifier: string) => {
    if (!identifier) return { success: false, error: 'Invalid user' };
    try {
        await connectDB();
        const profile = await AccountRepository.getProfileByIdentifier(identifier) as { _id: { toString(): string }; lastSeen?: Date } | null;
        if (!profile) return { success: false, error: 'User not found' };

        // Computed server-side from the caller's own JWT rather than having
        // the client compare emails - a session can be valid with no email
        // at all (e.g. a phone sign-up whose `email` field was cleared), and
        // an email-to-email comparison would just silently never match.
        const callerID = await extractUserIDFromCoockie().catch(() => null);
        const isOwn = typeof callerID === 'string' && callerID === profile._id.toString();

        // Mirrors the presence hiding in socket/handlers.ts's
        // recordLastSeen: blocking someone hides their last-seen from you,
        // same as it already hides their online dot, so this page can't be
        // used to see around that.
        if (!isOwn && typeof callerID === 'string') {
            const viewerBlockedIds = await AccountRepository.getBlockedIds(callerID);
            if (viewerBlockedIds.includes(profile._id.toString())) {
                delete profile.lastSeen;
            }
        }

        return { success: true, profile: JSON.parse(JSON.stringify(profile)), isOwn };
    } catch (err) {
        console.error('Failed to get profile:', err);
        return { success: false, error: 'Failed to load profile' };
    }
}

// Own-profile pages (unlike a chat participant's read-only view) must not
// depend on `user.email` to know who's asking - it can legitimately be
// missing for a valid session (see getProfile above), and any client-passed
// identifier is trust-the-client anyway. This resolves the caller purely
// from their own cookie/JWT, the same way updateMyProfile etc. already do.
export const getMyProfile = async () => {
    try {
        await connectDB();
        const userID = await extractUserIDFromCoockie();
        if (typeof userID !== 'string') return { success: false, error: 'Unauthorized' };

        const profile = await AccountRepository.getProfileByIdentifier(userID);
        if (!profile) return { success: false, error: 'User not found' };
        return { success: true, profile: JSON.parse(JSON.stringify(profile)) };
    } catch (err) {
        console.error('Failed to get own profile:', err);
        return { success: false, error: 'Failed to load profile' };
    }
}

export const updateMyProfile = async ({ nickname, about, accentColor }: { nickname?: string; about?: string; accentColor?: string }) => {
    try {
        await connectDB();
        const userID = await extractUserIDFromCoockie();
        if (typeof userID !== 'string') return { success: false, error: 'Unauthorized' };

        const updates: { nickname?: string; about?: string; accentColor?: string } = {};

        if (nickname !== undefined) {
            const trimmed = nickname.trim();
            if (!trimmed) return { success: false, error: 'Nickname is required' };
            if (trimmed.length > 40) return { success: false, error: 'Nickname must be 40 characters or fewer' };
            updates.nickname = trimmed;
        }

        if (about !== undefined) {
            const trimmed = about.trim();
            if (trimmed.length > ABOUT_MAX_LENGTH) return { success: false, error: `About must be ${ABOUT_MAX_LENGTH} characters or fewer` };
            updates.about = trimmed;
        }

        if (accentColor !== undefined) {
            if (!ACCENT_COLORS.includes(accentColor as typeof ACCENT_COLORS[number])) {
                return { success: false, error: 'Invalid accent color' };
            }
            updates.accentColor = accentColor;
        }

        const profile = await AccountRepository.updateProfile(userID, updates);
        if (!profile) return { success: false, error: 'Nothing to update' };

        revalidatePath('/profile');
        revalidatePath('/chat');
        return { success: true, profile: JSON.parse(JSON.stringify(profile)) };
    } catch (err) {
        console.error('Failed to update profile:', err);
        return { success: false, error: 'Failed to update profile' };
    }
}

// Kept separate from updateMyProfile: the avatar upload flow already has the
// new blob URL in hand (see uploadFile.tsx's pattern) and shouldn't need to
// resend nickname/about/accent just to change the picture. Deleting the
// previous blob is best-effort - a failure here shouldn't block the save,
// it just risks an orphaned blob rather than data loss.
export const updateMyAvatar = async (avatarUrl: string | null) => {
    try {
        await connectDB();
        const userID = await extractUserIDFromCoockie();
        if (typeof userID !== 'string') return { success: false, error: 'Unauthorized' };

        const current = await AccountRepository.getProfileByIdentifier(userID);
        const previousAvatarUrl = (current as { avatarUrl?: string } | null)?.avatarUrl;

        const profile = await AccountRepository.updateProfile(userID, { avatarUrl });

        if (previousAvatarUrl && previousAvatarUrl !== avatarUrl) {
            try {
                await deleteFile(previousAvatarUrl);
            } catch (err) {
                console.error('Failed to delete previous avatar blob:', err);
            }
        }

        if (!profile) return { success: false, error: 'Nothing to update' };

        revalidatePath('/profile');
        revalidatePath('/chat');
        return { success: true, profile: JSON.parse(JSON.stringify(profile)) };
    } catch (err) {
        console.error('Failed to update avatar:', err);
        return { success: false, error: 'Failed to update avatar' };
    }
}

// Two-step phone change: this sends a code to the account's own email to
// confirm the request came from the account holder (not proof the new phone
// number itself is reachable - that would need a paid per-attempt SMS send,
// which this project's free-tier infra avoids). confirmPhoneChange below
// verifies the code and applies the change.
export const requestPhoneChangeOTP = async (newPhone: string) => {
    if (!isPhone(newPhone)) return { success: false, error: INVALID_PHONE_MESSAGE };
    try {
        await connectDB();
        const userID = await extractUserIDFromCoockie();
        if (typeof userID !== 'string') return { success: false, error: 'Unauthorized' };

        const ownEmail = await getOwnEmailForPhoneChange(userID);
        if (!ownEmail) return { success: false, error: NO_EMAIL_ON_FILE_MESSAGE };

        const result = await requestOTP(ownEmail, 'change-phone', 'email');
        if (result.status !== 200) return { success: false, error: result.message || 'Failed to send verification code' };
        return { success: true };
    } catch (err) {
        console.error('Failed to request phone change OTP:', err);
        return { success: false, error: 'Failed to send verification code' };
    }
}

export const confirmPhoneChange = async (newPhone: string, otp: string) => {
    if (!isPhone(newPhone)) return { success: false, error: INVALID_PHONE_MESSAGE };
    try {
        await connectDB();
        const userID = await extractUserIDFromCoockie();
        if (typeof userID !== 'string') return { success: false, error: 'Unauthorized' };

        const ownEmail = await getOwnEmailForPhoneChange(userID);
        if (!ownEmail) return { success: false, error: NO_EMAIL_ON_FILE_MESSAGE };

        const verified = await verifyOTP(ownEmail, otp, 'email');
        if (verified.status !== 200) return { success: false, error: verified.message || 'Invalid or expired verification code' };

        try {
            const profile = await AccountRepository.updateProfile(userID, { phone: normalizePhone(newPhone) });
            if (!profile) return { success: false, error: 'Nothing to update' };

            await deleteOTP(ownEmail, 'email');
            revalidatePath('/profile');
            return { success: true, profile: JSON.parse(JSON.stringify(profile)) };
        } catch (err) {
            if ((err as { code?: number })?.code === 11000) {
                return { success: false, error: 'This phone number is already associated with another account.' };
            }
            throw err;
        }
    } catch (err) {
        console.error('Failed to confirm phone change:', err);
        return { success: false, error: 'Failed to update phone number' };
    }
}

// Every account has either a real email or a phone on file - unlike phone
// changes, this editor is always available. See requestEmailChangeOTP/
// confirmEmailChangeStep1/confirmEmailChange below for the two-code flow
// this drives: prove a channel already on the account, then prove the new
// inbox, before ever writing Account.email.
async function getOwnAccountForEmailChange(userID: string) {
    const account = await AccountRepository.getUserByID(userID) as { _id: { toString(): string }; email?: string; phone?: string; nickname?: string; isModerator?: boolean } | null;
    if (!account) return null;
    const hasRealEmail = isEmail(account.email);
    return { account, hasRealEmail, hasPhone: Boolean(account.phone) };
}

// Step 1 can prove ownership either way when both are on file - the current
// real email (default), or "I can't access this email", the phone already
// stored on the account (the only paid send in this flow - never the new
// number, and never a number the caller merely types in). A phone-only
// account (no real email yet) has no email option, so SMS is the only
// choice there. The client's requested channel is only ever a preference -
// this is the server-side authority on whether it's actually available.
function resolveEmailChangeChannel(requested: 'email' | 'sms' | undefined, hasRealEmail: boolean, hasPhone: boolean): { channel: 'email' | 'sms' } | { error: string } {
    const useSms = requested === 'sms';
    if (useSms) return hasPhone ? { channel: 'sms' } : { error: 'No phone number on file.' };
    return hasRealEmail ? { channel: 'email' } : { error: 'No email on file.' };
}

// Step 1 of 2: send a code to whichever contact is already verified and on
// the account. Also used to resend that same first code.
export const requestEmailChangeOTP = async (newEmail: string, channel?: 'email' | 'sms') => {
    const normalized = newEmail?.trim().toLowerCase();
    if (!isEmail(normalized)) return { success: false, error: INVALID_EMAIL_MESSAGE };
    try {
        await connectDB();
        const userID = await extractUserIDFromCoockie();
        if (typeof userID !== 'string') return { success: false, error: 'Unauthorized' };

        const own = await getOwnAccountForEmailChange(userID);
        if (!own) return { success: false, error: 'Account not found' };
        const { account, hasRealEmail, hasPhone } = own;

        if (hasRealEmail && account.email!.trim().toLowerCase() === normalized) {
            return { success: false, error: "That's already your email address." };
        }

        const resolved = resolveEmailChangeChannel(channel, hasRealEmail, hasPhone);
        if ('error' in resolved) return { success: false, error: resolved.error };

        // Early check for a better error before making the user verify their
        // current contact - the authoritative check happens again when the
        // code to the new address itself is actually sent (requestOTP's
        // 'change-email' mode, in confirmEmailChangeStep1/resendNewEmailChangeOTP).
        const existing = await isExist(normalized);
        if (existing.accountExists) return { success: false, error: EMAIL_TAKEN_MESSAGE };

        const result = resolved.channel === 'sms'
            ? await requestOTP(account.phone!, 'change-phone', 'sms')
            : await requestOTP(account.email!, 'change-phone', 'email');
        if (result.status !== 200) return { success: false, error: result.message || 'Failed to send verification code' };
        return { success: true, channel: resolved.channel };
    } catch (err) {
        console.error('Failed to request email change OTP:', err);
        return { success: false, error: 'Failed to send verification code' };
    }
}

// Step 1 confirm: verify the code sent to the current contact, then
// immediately send step 2's code to the new address.
export const confirmEmailChangeStep1 = async (newEmail: string, otp: string, channel?: 'email' | 'sms') => {
    const normalized = newEmail?.trim().toLowerCase();
    if (!isEmail(normalized)) return { success: false, error: INVALID_EMAIL_MESSAGE };
    try {
        await connectDB();
        const userID = await extractUserIDFromCoockie();
        if (typeof userID !== 'string') return { success: false, error: 'Unauthorized' };

        const own = await getOwnAccountForEmailChange(userID);
        if (!own) return { success: false, error: 'Account not found' };
        const { account, hasRealEmail, hasPhone } = own;

        const resolved = resolveEmailChangeChannel(channel, hasRealEmail, hasPhone);
        if ('error' in resolved) return { success: false, error: resolved.error };

        const contact = resolved.channel === 'sms' ? account.phone! : account.email!;
        const verified = await verifyOTP(contact, otp, resolved.channel);
        if (verified.status !== 200) return { success: false, error: verified.message || 'Invalid or expired verification code' };
        await deleteOTP(contact, resolved.channel);

        const result = await requestOTP(normalized, 'change-email', 'email');
        if (result.status !== 200) return { success: false, error: result.message || 'Failed to send verification code' };
        return { success: true };
    } catch (err) {
        console.error('Failed to confirm email change step 1:', err);
        return { success: false, error: 'Failed to verify code' };
    }
}

// Resend for step 2's code (to the new address) once step 1 is done.
export const resendNewEmailChangeOTP = async (newEmail: string) => {
    const normalized = newEmail?.trim().toLowerCase();
    if (!isEmail(normalized)) return { success: false, error: INVALID_EMAIL_MESSAGE };
    try {
        await connectDB();
        const userID = await extractUserIDFromCoockie();
        if (typeof userID !== 'string') return { success: false, error: 'Unauthorized' };

        const result = await requestOTP(normalized, 'change-email', 'email');
        if (result.status !== 200) return { success: false, error: result.message || 'Failed to send verification code' };
        return { success: true };
    } catch (err) {
        console.error('Failed to resend email change OTP:', err);
        return { success: false, error: 'Failed to send verification code' };
    }
}

// Step 2 confirm: verify the code sent to the new address, then write it -
// email is an identity key, not only a profile field, so this also reissues
// the caller's JWT and rewrites their message history's sender identity.
export const confirmEmailChange = async (newEmail: string, otp: string) => {
    const normalized = newEmail?.trim().toLowerCase();
    if (!isEmail(normalized)) return { success: false, error: INVALID_EMAIL_MESSAGE };
    try {
        await connectDB();
        const userID = await extractUserIDFromCoockie();
        if (typeof userID !== 'string') return { success: false, error: 'Unauthorized' };

        const account = await AccountRepository.getUserByID(userID) as { _id: { toString(): string }; email?: string; nickname?: string; isModerator?: boolean } | null;
        if (!account) return { success: false, error: 'Account not found' };

        const verified = await verifyOTP(normalized, otp, 'email');
        if (verified.status !== 200) return { success: false, error: verified.message || 'Invalid or expired verification code' };

        const oldEmail = account.email;

        let updated;
        try {
            updated = await AccountRepository.updateEmail(userID, normalized);
        } catch (err) {
            if ((err as { code?: number })?.code === 11000) return { success: false, error: EMAIL_TAKEN_MESSAGE };
            throw err;
        }
        if (!updated) return { success: false, error: 'Failed to update email' };

        // Conversation membership is by account id, but message authorship is
        // the email string (socket/handlers.ts compares message.sender to
        // socket.data.email) - without this, this account's prior messages
        // and any reply snapshot quoting them stop showing as theirs.
        if (oldEmail && oldEmail !== normalized) {
            await Promise.all([
                Message.updateMany({ sender: oldEmail }, { $set: { sender: normalized } }),
                Message.updateMany({ 'replyTo.sender': oldEmail }, { $set: { 'replyTo.sender': normalized } })
            ]);
        }

        await deleteOTP(normalized, 'email');

        // Same payload shape as authenticateUser - socket auth reads email
        // from this token (socket/authMIddleware.js), not the handshake
        // header, so the client must reconnect with it (see SocketProvider).
        const token = jwt.sign(
            { _id: account._id.toString(), email: normalized, nickname: account.nickname, isModerator: account.isModerator || false, signInTime: Date.now() },
            env.JWT_SECRET_KEY!,
            { expiresIn: '7d' }
        );

        revalidatePath('/profile');
        revalidatePath('/chat');
        return { success: true, profile: JSON.parse(JSON.stringify(updated)), token };
    } catch (err) {
        console.error('Failed to confirm email change:', err);
        return { success: false, error: 'Failed to update email address' };
    }
}
