"use client"
import '../../login/login.css'
import { JSX, useState } from "react";
import { useRouter } from 'next/navigation';
import { useUser } from '@/app/hooks/useUser';
import { Eye, EyeOff, Mail, Shield, Lock, KeyRound } from 'lucide-react';
import { requestOTP, verifyOTP, resetPassword, createAccount } from '@/app/lib/OTPActions'
import { isPhone } from '@/app/lib/contact';
import { useI18n } from '@/app/i18n/client';
import type { Locale } from '@/app/i18n/config';
import { pageTitleClassName } from '@/app/components/shell/pageTitle';
import PageTitle from '@/app/components/shell/fitTitle';

interface OTPProcessProps {
    mode: 'forgot' | 'sign-up';
}

export const sanitizePhoneInput = (value: string) => {
    const sanitized = value.replace(/[^\d\s()+-]/g, '');
    return sanitized.startsWith('+')
        ? `+${sanitized.slice(1).replace(/\+/g, '')}`
        : sanitized.replace(/\+/g, '');
};

const OTPProcess = ({ mode }: OTPProcessProps) => {
    const router = useRouter();
    const { updateUser } = useUser();
    const { t, dir: pageDir } = useI18n();

    const [step, setStep] = useState<'email' | 'otp' | 'password'>('email');
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [channel, setChannel] = useState<'email' | 'sms'>('email');
    // Email and SMS are separate inputs. Toggling must not copy or sanitize
    // one into the other (an address would otherwise collapse to leftover digits).
    const contact = channel === 'sms' ? phone : email;
    const [nickname, setNickname] = useState("");
    const [otp, setOtp] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [emailError, setEmailError] = useState("");
    const [otpError, setOtpError] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [confirmPasswordError, setConfirmPasswordError] = useState("");
    const [generalError, setGeneralError] = useState<string | JSX.Element>("");
    const [successMessage, setSuccessMessage] = useState("");

    const [loading, setLoading] = useState(false);
    const [resendTimer, setResendTimer] = useState(0);

    const validateEmail = (value: string): boolean => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
    }

    const clearErrors = () => {
        setEmailError("");
        setOtpError("");
        setPasswordError("");
        setConfirmPasswordError("");
        setGeneralError("");
        setSuccessMessage("");
    }

    const startResendTimer = () => {
        setResendTimer(60);
        const interval = setInterval(() => {
            setResendTimer(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }

    const handleSendOTP = async (event: React.FormEvent) => {
        event.preventDefault();
        clearErrors();

        if (!contact.trim()) {
            setEmailError(channel === 'sms' ? t("auth.otp.enterPhone") : t("auth.otp.enterEmail"));
            return;
        }

        if (channel === 'email' && !validateEmail(contact)) {
            setEmailError(t("auth.otp.invalidEmail"));
            return;
        }
        if (mode === 'sign-up' && !nickname.trim()) {
            setGeneralError(t("auth.otp.chooseNickname"));
            return;
        }
        if (channel === 'sms' && !isPhone(contact)) {
            setEmailError(t("auth.otp.invalidPhone"));
            return;
        }

        setLoading(true);

        try {
            const response = await requestOTP(contact, mode, channel);
            if (response.status === 200) {
                if (mode === 'forgot')
                    setSuccessMessage(channel === 'sms' ? t("auth.otp.forgotSentSms") : t("auth.otp.forgotSentEmail"));
                else
                    setSuccessMessage(channel === 'sms' ? t("auth.otp.sentSms") : t("auth.otp.sentEmail"));
                setStep('otp');
                startResendTimer();
            }
            else if (response.status === 400) {
                setGeneralError(response.message || (mode === 'sign-up' ? <>
                    {t("auth.otp.alreadyExists")}{" "}
                    <a href="/forgot-password" className="underline">{t("auth.otp.forgotPassword")}</a>
                </> : t("auth.otp.unableToSend")));
            }
            else {
                setGeneralError(response.message || t("auth.otp.failedToSend"));
            }
        } catch (err) {
            console.error('Send OTP error:', err);
            setGeneralError(t("auth.cannotConnect"));
        } finally {
            setLoading(false);
        }
    }

    const handleVerifyOTP = async (event: React.FormEvent) => {
        event.preventDefault();
        clearErrors();

        if (!/^\d{6}$/.test(otp)) {
            setOtpError(otp ? t("auth.otp.codeMustBeSixDigits") : t("auth.otp.enterCode"));
            return;
        }

        setLoading(true);

        try {
            const response = await verifyOTP(contact, otp, channel);

            if (response.status >= 200 && response.status < 300) {
                setSuccessMessage(t("auth.otp.verified"));
                setStep('password');
            } else {
                setGeneralError(response.message || t("auth.otp.invalidCode"));
            }
        } catch (err) {
            console.error('Verify OTP error:', err);
            setGeneralError(t("auth.cannotConnect"));
        } finally {
            setLoading(false);
        }
    }

    const handleResetPassword = async (event: React.FormEvent) => {
        event.preventDefault();
        clearErrors();

        if (!newPassword) {
            setPasswordError(t("auth.otp.enterNewPassword"));
            return;
        }

        if (newPassword.length < 8) {
            setPasswordError(t("auth.otp.passwordTooShort"));
            return;
        }

        if (!confirmPassword) {
            setConfirmPasswordError(t("auth.otp.confirmYourPassword"));
            return;
        }

        if (newPassword !== confirmPassword) {
            setConfirmPasswordError(t("auth.otp.passwordsDontMatch"));
            return;
        }

        setLoading(true);

        try {
            let response = null;
            if (mode === 'forgot')
                response = await resetPassword(contact, otp, newPassword, channel);
            else
                response = await createAccount(contact, otp, newPassword, nickname, channel);
            if (response.status >= 200 && response.status < 300) {
                if (mode === 'sign-up' && 'token' in response && response.token) {
                    const signupResponse = response as unknown as {
                        email: string;
                        nickname: string;
                        token: string;
                        isModerator: boolean;
                        locale?: Locale;
                    };
                    await updateUser({
                        email: signupResponse.email,
                        nickname: signupResponse.nickname,
                        token: signupResponse.token,
                        isModerator: signupResponse.isModerator,
                        locale: signupResponse.locale,
                    });
                }
                const confirmationMessage = mode === 'forgot' ? t("auth.otp.resetDone") :
                    t("auth.otp.accountCreated")
                setSuccessMessage(confirmationMessage);
                setTimeout(() => {
                    router.push(mode === 'sign-up' ? '/chat' : '/login');
                }, 2000);
            } else {
                const failedMessage = mode === 'forgot' ? response.message || t("auth.otp.resetFailed") :
                    response.message || t("auth.otp.createFailed");
                setGeneralError(failedMessage);
            }
        } catch (err) {
            console.error('Reset password error:', err);
            setGeneralError(t("auth.cannotConnect"));
        } finally {
            setLoading(false);
        }
    }

    const handleResendOTP = async () => {
        if (resendTimer > 0) return;

        clearErrors();
        setLoading(true);

        try {
            const response = await requestOTP(contact, mode, channel);
            if (response.status === 200) {
                setSuccessMessage(t("auth.otp.resent"));
                startResendTimer();
            } else {
                setGeneralError(response.message || t("auth.otp.resendFailed"));
            }
        } catch (err) {
            console.error('Resend OTP error:', err);
            setGeneralError(t("auth.otp.cannotConnectShort"));
        } finally {
            setLoading(false);
        }
    }

    const StepIndicator = () => {
        const steps = ['email', 'otp', 'password'];
        const currentStepIndex = steps.indexOf(step);

        return (
            <div className="flex justify-center gap-2">
                {steps.map((_, index) => (
                    <div
                        key={index}
                        className={`h-1 rounded-full transition-all duration-300 ${index === currentStepIndex
                            ? 'w-8 bg-gradient-to-r from-pink-400 to-indigo-700'
                            : index < currentStepIndex
                                ? 'w-1 bg-indigo-400'
                                : 'w-1 bg-gray-300 dark:bg-gray-600'
                            }`}
                    />
                ))}
            </div>
        );
    };

    const handleSubmit = step === 'email' ? handleSendOTP :
        step === 'otp' ? handleVerifyOTP : handleResetPassword;

    return (
        <form onSubmit={handleSubmit}>
            <div className="mainContainer grid px-3 pb-[calc(4rem+var(--bottom-prompt-height))] md:grid-cols-3 md:px-4 md:pb-[calc(2rem+var(--bottom-prompt-height))]">
                <div className='md:col-start-2 flex flex-col gap-3 md:gap-4'>
                    <div className="titleContainer">
                        <PageTitle className={pageTitleClassName}>
                            <span className="text-transparent bg-clip-text bg-linear-to-r to-indigo-800 from-pink-700 dark:to-indigo-400 dark:from-pink-300">
                                {step === 'email' && mode === 'forgot' ? t("auth.otp.titleReset") :
                                    step === 'email' && mode === 'sign-up' ? t("auth.otp.titleSignUp") :
                                        step === 'otp' ? t("auth.otp.titleVerify") :
                                            step === 'password' && mode === 'forgot' ? t("auth.otp.titleNewPassword") :
                                                t("auth.otp.titleSetPassword")}
                            </span>
                        </PageTitle>
                        {(generalError || successMessage) && (
                            <div className="mt-2 md:mt-8 font-normal">
                                <div className={`md:col-start-2 md:col-span-3 px-4 py-3 rounded mb-2 ${successMessage
                                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 whitespace-pre-line'
                                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                                    }`}>
                                    {successMessage || generalError}
                                </div>
                            </div>
                        )}
                        <p className="text-center text-gray-600 dark:text-gray-400 mt-0 md:mt-1 md:text-xl text-wrap mb-2 md:mb-3">
                            {step === 'email' ? (channel === 'sms' ? t("auth.otp.introSms") : t("auth.otp.introEmail")) :
                                step === 'otp' ? (channel === 'sms' ? t("auth.otp.introOtpSms") : t("auth.otp.introOtpEmail")) :
                                    t("auth.otp.introPassword")}
                        </p>
                    </div>

                    <div className="inputContainer space-y-1 md:grid grid-cols-5 p-1">
                        {step === 'email' && (
                            <div className="md:col-start-2 md:col-span-3">
                                <div className="hidden md:flex justify-center mb-3">
                                    <div className="w-12 h-12 bg-gradient-to-r from-pink-400 to-indigo-700 rounded-full flex items-center justify-center">
                                        <Mail size={24} className="text-white" />
                                    </div>
                                </div>

                                <div
                                    className="mb-3 flex rounded-lg border border-gray-300 bg-gray-200 p-1 dark:border-gray-500 dark:bg-gray-800"
                                    role="group"
                                    aria-label={t("auth.otp.method")}
                                >
                                    {(['email', 'sms'] as const).map(option => (
                                        <button
                                            key={option}
                                            type="button"
                                            aria-pressed={channel === option}
                                            onClick={() => {
                                                if (option === channel) return;
                                                setChannel(option);
                                                setEmailError("");
                                            }}
                                            className={`flex-1 rounded-md border py-2 text-sm font-medium transition-colors ${
                                                channel === option
                                                    ? 'border-indigo-500 bg-white text-indigo-700 shadow-sm dark:border-indigo-400 dark:bg-gray-900 dark:text-indigo-300'
                                                    : 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                                            }`}
                                        >
                                            {option === 'email' ? t("auth.otp.email") : t("auth.otp.sms")}
                                        </button>
                                    ))}
                                </div>
                                {mode === 'sign-up' && <input id="nickname" value={nickname} onChange={ev => setNickname(ev.target.value)} placeholder={t("auth.otp.nickname")} className="inputBox mb-3 w-full" maxLength={40} required />}
                                <label htmlFor="email" className="sr-only">{t("auth.otp.contactLabel")}</label>
                                {/* Left to right even in a right-to-left page, or the
                                    digit groups of a phone number come out reversed.
                                    Empty, the placeholder follows the page - set
                                    explicitly, since browsers make type="tel" left
                                    to right by default. The example number inside
                                    it is isolated left to right in the catalogs. */}
                                <input
                                    key={channel}
                                    id="email"
                                    type={channel === 'email' ? 'email' : 'tel'}
                                    dir={contact ? "ltr" : pageDir}
                                    value={contact}
                                    placeholder={channel === 'email' ? t("auth.otp.emailPlaceholder") : t("auth.otp.phonePlaceholder")}
                                    onChange={ev => {
                                        if (channel === 'sms') setPhone(sanitizePhoneInput(ev.target.value));
                                        else setEmail(ev.target.value);
                                    }}
                                    className="inputBox w-full"
                                    autoComplete={channel === 'email' ? 'email' : 'tel'}
                                    inputMode={channel === 'sms' ? 'tel' : undefined}
                                    disabled={loading}
                                    aria-invalid={!!emailError}
                                    aria-describedby={emailError ? "email-error" : undefined}
                                />
                                {emailError && (
                                    <label id="email-error" className="errorLabel block mt-1">
                                        {emailError}
                                    </label>
                                )}

                                <div className="hidden md:flex items-center justify-center gap-1.5 text-xs text-muted-foreground mt-2">
                                    <Shield size={14} />
                                    <span>{t("auth.otp.secure")}</span>
                                </div>

                                <div className="hidden md:block mt-3">
                                    <StepIndicator />
                                </div>
                            </div>
                        )}

                        {step === 'otp' && (
                            <div className="md:col-start-2 md:col-span-3">
                                <div className="hidden md:flex justify-center mb-3">
                                    <div className="w-12 h-12 bg-gradient-to-r from-pink-400 to-indigo-700 rounded-full flex items-center justify-center">
                                        <KeyRound size={24} className="text-white" />
                                    </div>
                                </div>

                                <label htmlFor="otp" className="sr-only">{t("auth.otp.codeLabel")}</label>
                                <input
                                    id="otp"
                                    type="text"
                                    dir="ltr"
                                    value={otp}
                                    placeholder={t("auth.otp.codePlaceholder")}
                                    onChange={ev => setOtp(ev.target.value.replace(/\D/g, '').slice(0, 6))}
                                    className="inputBox w-full text-center text-2xl tracking-widest"
                                    maxLength={6}
                                    inputMode="numeric"
                                    pattern="[0-9]{6}"
                                    autoComplete="one-time-code"
                                    disabled={loading}
                                    aria-invalid={!!otpError}
                                    aria-describedby={otpError ? "otp-error" : undefined}
                                />
                                {otpError && (
                                    <label id="otp-error" className="errorLabel block mt-1">
                                        {otpError}
                                    </label>
                                )}
                                <div className="text-center mt-4">
                                    <button
                                        type="button"
                                        onClick={handleResendOTP}
                                        disabled={resendTimer > 0 || loading}
                                        className="text-sm text-blue-600 dark:text-blue-500 hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
                                    >
                                        {resendTimer > 0 ? t("auth.otp.resendIn", { seconds: resendTimer }) : t("auth.otp.resend")}
                                    </button>
                                </div>

                                <div className="hidden md:block mt-3">
                                    <StepIndicator />
                                </div>
                            </div>
                        )}

                        {step === 'password' && (
                            <>
                                <div className="hidden md:flex md:col-start-2 md:col-span-3 justify-center mb-3">
                                    <div className="w-12 h-12 bg-gradient-to-r from-pink-400 to-indigo-700 rounded-full flex items-center justify-center">
                                        <Lock size={24} className="text-white" />
                                    </div>
                                </div>

                                <div className="md:col-start-2 md:col-span-3">
                                    <label htmlFor="new-password" className="sr-only">{t("auth.otp.newPassword")}</label>
                                    <div className="relative">
                                        <input
                                            id="new-password"
                                            type={showNewPassword ? "text" : "password"}
                                            value={newPassword}
                                            placeholder={mode === 'forgot' ? t("auth.otp.newPasswordPlaceholder") : t("auth.otp.passwordPlaceholder")}
                                            onChange={ev => setNewPassword(ev.target.value)}
                                            className="inputBox w-full pe-10"
                                            autoComplete="new-password"
                                            disabled={loading}
                                            aria-invalid={!!passwordError}
                                            aria-describedby={passwordError ? "password-error" : undefined}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                            className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                            aria-label={showNewPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                                            tabIndex={-1}
                                            disabled={loading}
                                        >
                                            {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    </div>
                                    {passwordError && (
                                        <label id="password-error" className="errorLabel block mt-1">
                                            {passwordError}
                                        </label>
                                    )}
                                </div>

                                <div className="md:col-start-2 md:col-span-3">
                                    <label htmlFor="confirm-password" className="sr-only">{t("auth.otp.confirmPassword")}</label>
                                    <div className="relative">
                                        <input
                                            id="confirm-password"
                                            type={showConfirmPassword ? "text" : "password"}
                                            value={confirmPassword}
                                            placeholder={mode === 'forgot' ? t("auth.otp.confirmNewPlaceholder") : t("auth.otp.confirmPlaceholder")}
                                            onChange={ev => setConfirmPassword(ev.target.value)}
                                            className="inputBox w-full pe-10"
                                            autoComplete="new-password"
                                            disabled={loading}
                                            aria-invalid={!!confirmPasswordError}
                                            aria-describedby={confirmPasswordError ? "confirm-password-error" : undefined}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                            aria-label={showConfirmPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                                            tabIndex={-1}
                                            disabled={loading}
                                        >
                                            {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    </div>
                                    {confirmPasswordError && (
                                        <label id="confirm-password-error" className="errorLabel block mt-1">
                                            {confirmPasswordError}
                                        </label>
                                    )}
                                </div>

                                <div className="hidden md:block md:col-start-2 md:col-span-3 mt-3">
                                    <StepIndicator />
                                </div>
                            </>
                        )}
                    </div>

                    <div className="grid">
                        <div className="inputContainer flex flex-col items-center justify-self-center">
                            <button
                                className="inputButton disabled:opacity-50 disabled:cursor-not-allowed"
                                type="submit"
                                disabled={loading}
                            >
                                {loading ? t("auth.otp.processing") :
                                    step === 'email' ? t("auth.otp.sendCode") :
                                        step === 'otp' ? t("auth.otp.verifyCode") :
                                            step === 'password' && mode === 'forgot' ? t("auth.otp.resetPassword") :
                                                t("auth.otp.createAccount")}
                            </button>
                        </div>
                        {mode === 'forgot' &&
                            <p className="text-muted-foreground justify-self-center mt-4">
                                {t("auth.otp.rememberPassword")} <a href="/login"
                                    className="font-medium text-blue-600 underline dark:text-blue-500 hover:no-underline">{t("auth.otp.backToLogin")}</a>
                            </p>
                        }
                        {mode === 'sign-up' &&
                            <p className="text-muted-foreground justify-self-center mt-4">
                                {t("auth.otp.haveAccount")} <a href="/login"
                                    className="font-medium text-blue-600 underline dark:text-blue-500 hover:no-underline">{t("auth.otp.signIn")}</a>
                            </p>
                        }
                        {/* Under the create-account button on every sign-up step,
                            so it's there before an email or phone number is given
                            as much as when the account is created. */}
                        {mode === 'sign-up' &&
                            <p className="text-sm text-muted-foreground justify-self-center text-center mt-2 px-4">
                                {t.rich("auth.otp.privacyNote", {
                                    link: chunk => <a href="/privacy"
                                        className="font-medium text-blue-600 underline dark:text-blue-500 hover:no-underline">{chunk}</a>
                                })}
                            </p>
                        }
                    </div>
                </div>
            </div>
        </form >
    );
}

export default OTPProcess;
