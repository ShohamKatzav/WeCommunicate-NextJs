"use client";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Trash2 } from "lucide-react";
import { requestAccountDeletionCode, deleteMyAccount } from "../../lib/accountDeletionActions";
import { useSocket } from "../../hooks/useSocket";
import { useLogOut } from "../../hooks/useLogOut";
import { useI18n } from "../../i18n/client";

const RESEND_COOLDOWN_SECONDS = 60;
const inputClassName = "flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent";

// Permanently deleting your own account, at the bottom of /profile/edit.
// Closed by default: the explanation and the button stay one tap away, and
// the edit form above can finish on a phone screen. The code goes to the
// account's own email - or by SMS for a phone-only account - chosen on the
// server (accountDeletionActions.ts); nothing here says where. A correct
// code deletes the account in that request; then this tab tells the
// account's other tabs to sign out, and signs itself out the way Log out
// does.
const DeleteAccountSection = () => {
    const { t } = useI18n();
    const { socket } = useSocket();
    const logOut = useLogOut();
    const [step, setStep] = useState<'idle' | 'code'>('idle');
    const [sent, setSent] = useState<{ channel: 'email' | 'sms'; destination: string } | null>(null);
    const [otp, setOtp] = useState('');
    const [sending, setSending] = useState(false);
    const [deleting, setDeleting] = useState(false);
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
        setStep('idle');
        setSent(null);
        setOtp('');
        setResendTimer(0);
    };

    const handleSendCode = async () => {
        setSending(true);
        try {
            const result = await requestAccountDeletionCode();
            if (result.success && result.channel && result.destination) {
                setSent({ channel: result.channel, destination: result.destination });
                setStep('code');
                startResendTimer();
            } else {
                toast.error(result.error || t('profile.contact.sendFailed'));
            }
        } catch {
            // Server actions throw offline (the service worker 503s them).
            toast.info(t('profile.delete.offline'));
        } finally {
            setSending(false);
        }
    };

    const handleDelete = async () => {
        if (!/^\d{6}$/.test(otp)) {
            toast.error(t('profile.contact.enterSixDigits'));
            return;
        }
        setDeleting(true);
        try {
            const result = await deleteMyAccount(otp);
            if (!result.success) {
                toast.error(result.error || t('profile.delete.failed'));
                setDeleting(false);
                return;
            }
            // Before this tab's own socket goes: the server signs the
            // account's other tabs out (handleAccountDeleted). Not waited on
            // for long - this tab leaves either way.
            if (socket?.connected) {
                await socket.timeout(3000).emitWithAck('account deleted').catch(() => { });
            }
            toast.success(t('profile.delete.deleted'));
            await logOut({ destination: '/', clearOutbox: true });
        } catch {
            toast.info(t('profile.delete.offline'));
            setDeleting(false);
        }
    };

    return (
        <section
            aria-labelledby="delete-account-title"
            data-testid="delete-account-section"
            className="mt-3 border-t border-border pt-2 sm:mt-6 sm:pt-4"
        >
            <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-1 [&::-webkit-details-marker]:hidden">
                    <h2 id="delete-account-title" className="text-sm font-semibold text-destructive">
                        {t('profile.delete.title')}
                    </h2>
                    <ChevronDown className="h-4 w-4 shrink-0 text-destructive transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="pt-2">
                    <p className="text-sm text-muted-foreground">
                        {t('profile.delete.body')}
                    </p>

                    {step === 'idle' && (
                        <button
                            type="button"
                            onClick={handleSendCode}
                            disabled={sending}
                            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-destructive px-3 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Trash2 size={16} aria-hidden="true" />
                            {sending ? t('profile.contact.sending') : t('profile.delete.start')}
                        </button>
                    )}

                    {step === 'code' && sent && (
                        <div className="mt-3 space-y-2">
                            <p className="text-sm">
                                {t.rich(sent.channel === 'sms' ? 'profile.delete.codeSentSms' : 'profile.delete.codeSentEmail', {
                                    destination: sent.destination,
                                    b: chunk => <bdi dir="ltr" className="font-medium">{chunk}</bdi>,
                                })}
                            </p>
                            <div className="flex gap-2">
                                <label htmlFor="delete-account-otp" className="sr-only">{t('profile.contact.codeLabel')}</label>
                                <input
                                    id="delete-account-otp"
                                    type="text"
                                    dir="ltr"
                                    value={otp}
                                    onChange={ev => setOtp(ev.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder={t('profile.contact.codePlaceholder')}
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    maxLength={6}
                                    disabled={deleting}
                                    className={`${inputClassName} text-center tracking-widest`}
                                />
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    disabled={deleting || otp.length !== 6}
                                    className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {deleting ? t('profile.delete.deleting') : t('profile.delete.confirm')}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSendCode}
                                    disabled={resendTimer > 0 || sending || deleting}
                                    className="text-sm text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
                                >
                                    {resendTimer > 0 ? t('profile.contact.resendIn', { seconds: resendTimer }) : t('profile.contact.resend')}
                                </button>
                                <button
                                    type="button"
                                    onClick={reset}
                                    disabled={deleting}
                                    className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                                >
                                    {t('profile.contact.cancel')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </details>
        </section>
    );
};

export default DeleteAccountSection;
