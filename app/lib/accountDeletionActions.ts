"use server"
import connectDB from '@/app/lib/MongoDb';
import AccountRepository from '@/repositories/AccountRepository';
import AccountDeletionService from '@/services/AccountDeletionService';
import { extractUserIDFromCoockie } from '@/app/lib/cookieActions';
import { requestOTP, verifyOTP } from '@/app/lib/OTPActions';
import { isEmail, type VerificationChannel } from '@/app/lib/contact';
import { getT } from '@/app/i18n/server';

type SessionAccount = { _id: { toString(): string }; email: string; phone?: string; avatarUrl?: string };

// Where the code goes is decided here, from the session's own account - never
// from anything the browser sends. A real email gets the email code; a
// phone-only account's stored email is the synthetic "phone:..." key
// (createUser in accountActions.ts), which is no inbox, so it gets an SMS to
// the account's phone instead, the same Brevo path as phone sign-up.
async function loadSessionAccount() {
    const userID = await extractUserIDFromCoockie().catch(() => null);
    if (typeof userID !== 'string') return null;
    await connectDB();
    const account = await AccountRepository.getUserByID(userID) as SessionAccount | null;
    if (!account) return null;
    const destination: { contact: string; channel: VerificationChannel } | null = isEmail(account.email)
        ? { contact: account.email, channel: 'email' }
        : account.phone ? { contact: account.phone, channel: 'sms' } : null;
    return { account, destination };
}

// Step 1, and the resend: a code to the account's own email or phone, with
// the same 10-minute expiry, 60-second resend cooldown and attempt limit as
// every other code (OTPActions.ts). Returns where it went so the page can
// say so - it's the user's own contact, already shown on their profile.
export const requestAccountDeletionCode = async () => {
    const t = await getT();
    try {
        const session = await loadSessionAccount();
        if (!session) return { success: false, error: t('errors.unauthorized') };
        if (!session.destination) return { success: false, error: t('errors.noContactForDeletion') };

        const { contact, channel } = session.destination;
        const result = await requestOTP(contact, 'delete-account', channel);
        if (result.status !== 200) return { success: false, error: result.message || t('errors.sendCodeFailed') };
        return { success: true, channel, destination: contact };
    } catch (err) {
        console.error('Failed to send account deletion code:', err);
        return { success: false, error: t('errors.sendCodeFailed') };
    }
};

// Step 2: a correct code deletes the account in this same request. A wrong
// or expired one deletes nothing. Signing out (the session cookie) and
// telling the account's other tabs are the client's next steps - see
// DeleteAccountSection.
export const deleteMyAccount = async (otp: string) => {
    const t = await getT();
    try {
        const session = await loadSessionAccount();
        if (!session) return { success: false, error: t('errors.unauthorized') };
        if (!session.destination) return { success: false, error: t('errors.noContactForDeletion') };

        const { contact, channel } = session.destination;
        const verified = await verifyOTP(contact, typeof otp === 'string' ? otp.trim() : '', channel);
        if (verified.status !== 200) return { success: false, error: verified.message || t('errors.invalidCode') };

        // Removes the code with the rest of the account's Redis keys, so it
        // can't be used twice.
        await AccountDeletionService.deleteAccount({
            _id: session.account._id.toString(),
            email: session.account.email,
            phone: session.account.phone,
            avatarUrl: session.account.avatarUrl,
        });
        return { success: true };
    } catch (err) {
        console.error('Failed to delete account:', err);
        return { success: false, error: t('errors.deleteAccountFailed') };
    }
};
