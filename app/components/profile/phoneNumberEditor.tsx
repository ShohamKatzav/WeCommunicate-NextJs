"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Phone as PhoneIcon, Pencil, X } from "lucide-react";
import { isPhone } from "../../lib/contact";
import { sanitizePhoneInput } from "../auth/OTPProcess";
import { requestPhoneChangeOTP, confirmPhoneChange } from "../../lib/profileActions";
import { useT } from "../../i18n/client";

interface PhoneNumberEditorProps {
    currentPhone?: string;
    // False for accounts with no real email on file (phone-only sign-ups) -
    // there's nowhere free to verify a change against. See
    // errors.noEmailForPhoneChange in app/i18n/en.ts.
    canEdit: boolean;
    onChanged: (phone: string) => void;
}

type Step = 'view' | 'enter-phone' | 'enter-otp';

const RESEND_COOLDOWN_SECONDS = 60;
const inputClassName = "flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent";

const PhoneNumberEditor = ({ currentPhone, canEdit, onChanged }: PhoneNumberEditorProps) => {
    const t = useT();
    const [step, setStep] = useState<Step>('view');
    const [newPhone, setNewPhone] = useState('');
    const [otp, setOtp] = useState('');
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
        setNewPhone('');
        setOtp('');
        setResendTimer(0);
    };

    const handleSendCode = async () => {
        if (!isPhone(newPhone)) {
            toast.error(t('profile.contact.invalidPhone'));
            return;
        }
        setSending(true);
        try {
            const result = await requestPhoneChangeOTP(newPhone);
            if (result.success) {
                setStep('enter-otp');
                startResendTimer();
                toast.success(t('profile.contact.phoneCodeSent'));
            } else {
                toast.error(result.error || t('profile.contact.sendFailed'));
            }
        } finally {
            setSending(false);
        }
    };

    const handleConfirm = async () => {
        if (!/^\d{6}$/.test(otp)) {
            toast.error(t('profile.contact.enterSixDigits'));
            return;
        }
        setConfirming(true);
        try {
            const result = await confirmPhoneChange(newPhone, otp);
            if (result.success) {
                onChanged(newPhone);
                toast.success(t('profile.contact.phoneUpdated'));
                reset();
            } else {
                toast.error(result.error || t('profile.contact.verifyFailed'));
            }
        } finally {
            setConfirming(false);
        }
    };

    if (!canEdit) {
        return (
            <div data-testid="phone-number-editor">
                <span className="block text-sm font-medium mb-1">{t('profile.contact.phone')}</span>
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900 text-muted-foreground text-sm">
                    <PhoneIcon size={16} aria-hidden="true" />
                    {currentPhone ? <bdi dir="ltr">{currentPhone}</bdi> : t('profile.contact.notSet')}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                    {t('profile.contact.phoneLocked')}
                </p>
            </div>
        );
    }

    return (
        <div data-testid="phone-number-editor">
            <span className="block text-sm font-medium mb-1">{t('profile.contact.phone')}</span>

            {step === 'view' && (
                <div className="flex items-center justify-between gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">
                    <span className="flex items-center gap-2 text-sm">
                        <PhoneIcon size={16} className="text-muted-foreground" aria-hidden="true" />
                        {currentPhone ? <bdi dir="ltr">{currentPhone}</bdi> : <span className="text-muted-foreground italic">{t('profile.contact.notSet')}</span>}
                    </span>
                    <button
                        type="button"
                        onClick={() => setStep('enter-phone')}
                        className="flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                        <Pencil size={14} aria-hidden="true" /> {currentPhone ? t('profile.contact.change') : t('profile.contact.add')}
                    </button>
                </div>
            )}

            {step === 'enter-phone' && (
                <div className="space-y-2">
                    <div className="flex gap-2">
                        <label htmlFor="new-phone" className="sr-only">{t('profile.contact.newPhone')}</label>
                        <input
                            id="new-phone"
                            type="tel"
                            dir={newPhone ? "ltr" : undefined}
                            value={newPhone}
                            onChange={ev => setNewPhone(sanitizePhoneInput(ev.target.value))}
                            placeholder="+972 50 123 4567"
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
                        disabled={sending || !newPhone}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {sending ? t('profile.contact.sending') : t('profile.contact.sendCode')}
                    </button>
                    <p className="text-xs text-muted-foreground">
                        {t('profile.contact.phoneHint')}
                    </p>
                </div>
            )}

            {step === 'enter-otp' && (
                <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                        {t('profile.contact.phoneEnterCode', { phone: newPhone })}
                    </p>
                    <div className="flex gap-2">
                        <label htmlFor="phone-otp" className="sr-only">{t('profile.contact.codeLabel')}</label>
                        <input
                            id="phone-otp"
                            type="text"
                            dir="ltr"
                            value={otp}
                            onChange={ev => setOtp(ev.target.value.replace(/\D/g, '').slice(0, 6))}
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
                            onClick={handleConfirm}
                            disabled={confirming || otp.length !== 6}
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
        </div>
    );
};

export default PhoneNumberEditor;
