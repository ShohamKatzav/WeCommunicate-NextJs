"use server"
import connectDB from "@/app/lib/MongoDb";
import AccountRepository from "@/repositories/AccountRepository";
import { extractUserIDFromCoockie } from "@/app/lib/cookieActions";
import { deleteFile } from "@/app/lib/fileActions";
import { requestOTP, verifyOTP, deleteOTP } from "@/app/lib/OTPActions";
import { isEmail, isPhone, normalizePhone } from "@/app/lib/contact";
import { ABOUT_MAX_LENGTH, ACCENT_COLORS } from "@/app/config/limits";
import { revalidatePath } from "next/cache";

const INVALID_PHONE_MESSAGE = 'Use an international phone number, e.g. +972 50 123 4567';
const NO_EMAIL_ON_FILE_MESSAGE = "Phone number changes are verified by email, and this account doesn't have one on file.";

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
        const profile = await AccountRepository.getProfileByIdentifier(identifier) as { _id: { toString(): string } } | null;
        if (!profile) return { success: false, error: 'User not found' };

        // Computed server-side from the caller's own JWT rather than having
        // the client compare emails - a session can be valid with no email
        // at all (e.g. a phone sign-up whose `email` field was cleared), and
        // an email-to-email comparison would just silently never match.
        const callerID = await extractUserIDFromCoockie().catch(() => null);
        const isOwn = typeof callerID === 'string' && callerID === profile._id.toString();

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
