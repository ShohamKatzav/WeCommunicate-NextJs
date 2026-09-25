"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Mail as MailIcon, Pencil, X } from "lucide-react";
import { requestEmailChangeOTP, confirmEmailChangeStep1, resendNewEmailChangeOTP, confirmEmailChange } from "../../lib/profileActions";
import { useT } from "../../i18n/client";

interface EmailAddressEditorProps {
    currentEmail?: string;
    // False for phone sign-up accounts with no real email on file yet - see
    // getOwnAccountForEmailChange in app/lib/profileActions.ts. This editor
    // is always usable either way (every account has an email or a phone),
    // unlike PhoneNumberEditor which can be fully disabled.
    hasRealEmail: boolean;
    // Whether a phone number is on file - offers an "I can't access this
    // email" SMS path even when hasRealEmail is also true, not just for
    // phone-only accounts. See resolveEmailChangeChannel in
    // app/lib/profileActions.ts, the server-side authority on which
    // channel is actually usable.
    hasPhone: boolean;
    onChanged: (email: string, token: string) => void;
}

type Step = 'view' | 'enter-email' | 'verify-current' | 'verify-new';
type VerifyChannel = 'email' | 'sms';

const RESEND_COOLDOWN_SECONDS = 60;
const inputClassName = "flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent";

const EmailAddressEditor = ({ currentEmail, hasRealEmail, hasPhone, onChanged }: EmailAddressEditorProps) => {
    const t = useT();
    const defaultChannel: VerifyChannel = hasRealEmail ? 'email' : 'sms';
    const [step, setStep] = useState<Step>('view');
    const [newEmail, setNewEmail] = useState('');
    const [channel, setChannel] = useState<VerifyChannel>(defaultChannel);
    const [currentOtp, setCurrentOtp] = useState('');
    const [newOtp, setNewOtp] = useState('');
    const [sending, setSending] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [resendTimer, setResendTimer] = useState(0);

    const startResendTimer = () => {
        setResendTimer(RESEND_COOLDOWN_SECONDS);
        const interval = setInterval(() => {
            setResendTimer(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const reset = () => {
        setStep('view');
        setNewEmail('');
        setChannel(defaultChannel);
        setCurrentOtp('');
        setNewOtp('');
        setResendTimer(0);
    };

    const handleSendCode = async () => {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())) {
            toast.error(t('profile.contact.invalidEmail'));
            return;
        }
        setSending(true);
        try {
            const result = await requestEmailChangeOTP(newEmail, channel);
            if (result.success) {
                setStep('verify-current');
                startResendTimer();
                toast.success(channel === 'sms'
                    ? t('profile.contact.emailCodeTexted')
                    : t('profile.contact.emailCodeSentCurrent'));
            } else {
                toast.error(result.error || t('profile.contact.sendFailed'));
            }
        } finally {
            setSending(false);
        }
    };

    const handleConfirmCurrent = async () => {
        if (!/^\d{6}$/.test(currentOtp)) {
            toast.error(t('profile.contact.enterSixDigits'));
            return;
        }
        setConfirming(true);
        try {
            const result = await confirmEmailChangeStep1(newEmail, currentOtp, channel);
            if (result.success) {
                setStep('verify-new');
                setCurrentOtp('');
                startResendTimer();
                toast.success(t('profile.contact.emailCodeSentTo', { email: newEmail }));
            } else {
                toast.error(result.error || t('profile.contact.verifyFailed'));
            }
        } finally {
            setConfirming(false);
        }
    };

    const handleResendNew = async () => {
        setSending(true);
        try {
            const result = await resendNewEmailChangeOTP(newEmail);
            if (result.success) {
                startResendTimer();
                toast.success(t('profile.contact.emailCodeSentTo', { email: newEmail }));
            } else {
                toast.error(result.error || t('profile.contact.sendFailed'));
            }
        } finally {
            setSending(false);
        }
    };

    const handleConfirmNew = async () => {
        if (!/^\d{6}$/.test(newOtp)) {
            toast.error(t('profile.contact.enterSixDigits'));
            return;
        }
        setConfirming(true);
        try {
            const result = await confirmEmailChange(newEmail, newOtp);
            if (result.success && result.token) {
                onChanged(newEmail, result.token);
                toast.success(t('profile.contact.emailUpdated'));
                reset();
            } else {
                toast.error(result.error || t('profile.contact.verifyFailed'));
            }
        } finally {
            setConfirming(false);
        }
    };

    return (
        <div data-testid="email-address-editor">
            <span className="block text-sm font-medium mb-1">{t('profile.contact.email')}</span>

            {step === 'view' && (
                <div className="flex items-center justify-between gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">
                    <span className="flex items-center gap-2 text-sm">
                        <MailIcon size={16} className="text-muted-foreground" aria-hidden="true" />
                        {hasRealEmail ? <bdi dir="ltr">{currentEmail}</bdi> : <span className="text-muted-foreground italic">{t('profile.contact.notSet')}</span>}
                    </span>
                    <button
                        type="button"
                        onClick={() => setStep('enter-email')}
                        className="flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                        <Pencil size={14} aria-hidden="true" /> {hasRealEmail ? t('profile.contact.change') : t('profile.contact.add')}
                    </button>
                </div>
            )}

            {step === 'enter-email' && (
                <div className="space-y-2">
                    <div className="flex gap-2">
                        <label htmlFor="new-email" className="sr-only">{t('profile.contact.newEmail')}</label>
                        <input
                            id="new-email"
                            type="email"
                            dir={newEmail ? "ltr" : undefined}
                            value={newEmail}
                            onChange={ev => setNewEmail(ev.target.value)}
                            placeholder="you@example.com"
                            disabled={sending}
                            className={inputClassName}
                        />
                        <button type="button" onClick={reset} disabled={sending} className="px-3 py-2 text-muted-foreground hover:text-foreground" aria-label={t('profile.contact.cancel')}>
                            <X size={18} />
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={handleSendCode}
                        disabled={sending || !newEmail}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {sending ? t('profile.contact.sending') : t('profile.contact.sendCode')}
                    </button>
                    <p className="text-xs text-muted-foreground">
                        {channel === 'sms' ? t('profile.contact.emailHintSms') : t('profile.contact.emailHintEmail')}
                    </p>
                    {/* Only offered when both are on file - a phone-only
                        account has no email to fall back to, and an
                        account with no phone has no SMS option at all. */}
                    {hasRealEmail && hasPhone && (
                        <button
                            type="button"
                            onClick={() => setChannel(channel === 'email' ? 'sms' : 'email')}
                            disabled={sending}
                            className="block text-xs text-blue-600 dark:text-blue-500 hover:underline disabled:opacity-50"
                        >
                            {channel === 'email' ? t('profile.contact.cantAccessEmail') : t('profile.contact.useEmailInstead')}
                        </button>
                    )}
                </div>
            )}

            {step === 'verify-current' && (
                <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                        {channel === 'sms'
                            ? t('profile.contact.verifyCurrentSms', { email: newEmail })
                            : t('profile.contact.verifyCurrentEmail', { email: newEmail })}
                    </p>
                    <div className="flex gap-2">
                        <label htmlFor="current-otp" className="sr-only">{t('profile.contact.codeLabel')}</label>
                        <input
                            id="current-otp"
                            type="text"
                            dir="ltr"
                            value={currentOtp}
                            onChange={ev => setCurrentOtp(ev.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder={t('profile.contact.codePlaceholder')}
                            inputMode="numeric"
                            maxLength={6}
                            disabled={confirming}
                            className={`${inputClassName} text-center tracking-widest`}
                        />
                        <button type="button" onClick={reset} disabled={confirming} className="px-3 py-2 text-muted-foreground hover:text-foreground" aria-label={t('profile.contact.cancel')}>
                            <X size={18} />
                        </button>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleConfirmCurrent}
                            disabled={confirming || currentOtp.length !== 6}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {confirming ? t('profile.contact.verifying') : t('profile.contact.confirm')}
                        </button>
                        <button
                            type="button"
                            onClick={handleSendCode}
                            disabled={resendTimer > 0 || sending}
                            className="text-sm text-blue-600 dark:text-blue-500 hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
                        >
                            {resendTimer > 0 ? t('profile.contact.resendIn', { seconds: resendTimer }) : t('profile.contact.resend')}
                        </button>
                    </div>
                </div>
            )}

            {step === 'verify-new' && (
                <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                        {t('profile.contact.verifyNew', { email: newEmail })}
                    </p>
                    <div className="flex gap-2">
                        <label htmlFor="new-otp" className="sr-only">{t('profile.contact.codeLabel')}</label>
                        <input
                            id="new-otp"
                            type="text"
                            dir="ltr"
                            value={newOtp}
                            onChange={ev => setNewOtp(ev.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder={t('profile.contact.codePlaceholder')}
                            inputMode="numeric"
                            maxLength={6}
                            disabled={confirming}
                            className={`${inputClassName} text-center tracking-widest`}
                        />
                        <button type="button" onClick={reset} disabled={confirming} className="px-3 py-2 text-muted-foreground hover:text-foreground" aria-label={t('profile.contact.cancel')}>
                            <X size={18} />
                        </button>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleConfirmNew}
                            disabled={confirming || newOtp.length !== 6}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {confirming ? t('profile.contact.verifying') : t('profile.contact.confirm')}
                        </button>
                        <button
                            type="button"
                            onClick={handleResendNew}
                            disabled={resendTimer > 0 || sending}
                            className="text-sm text-blue-600 dark:text-blue-500 hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
                        >
                            {resendTimer > 0 ? t('profile.contact.resendIn', { seconds: resendTimer }) : t('profile.contact.resend')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmailAddressEditor;
