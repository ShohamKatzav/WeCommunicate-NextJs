"use client"
import '../login/login.css'
import { JSX, useState } from "react";
import { useRouter } from 'next/navigation';
import { useUser } from '@/app/hooks/useUser';
import { Eye, EyeOff, Mail, Shield, Lock, KeyRound } from 'lucide-react';
import { requestOTP, verifyOTP, resetPassword, createAccount } from '@/app/lib/OTPActions'
import { isPhone } from '@/app/lib/contact';

interface OTPProcessProps {
    mode: 'forgot' | 'sign-up';
}

const sanitizePhoneInput = (value: string) => {
    const sanitized = value.replace(/[^\d\s()+-]/g, '');
    return sanitized.startsWith('+')
        ? `+${sanitized.slice(1).replace(/\+/g, '')}`
        : sanitized.replace(/\+/g, '');
};

const OTPProcess = ({ mode }: OTPProcessProps) => {
    const router = useRouter();
    const { updateUser } = useUser();

    const [step, setStep] = useState<'email' | 'otp' | 'password'>('email');
    const [email, setEmail] = useState("");
    const [channel, setChannel] = useState<'email' | 'sms'>('email');
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

        if (!email.trim()) {
            setEmailError(channel === 'sms' ? "Please enter your phone number" : "Please enter your email");
            return;
        }

        if (channel === 'email' && !validateEmail(email)) {
            setEmailError("Please enter a valid email");
            return;
        }
        if (mode === 'sign-up' && !nickname.trim()) {
            setGeneralError('Please choose a nickname');
            return;
        }
        if (channel === 'sms' && !isPhone(email)) {
            setEmailError("Use an international phone number, e.g. +972 50 123 4567");
            return;
        }

        setLoading(true);

        try {
            const response = await requestOTP(email, mode, channel);
            if (response.status === 200) {
                if (mode === 'forgot')
                    setSuccessMessage(`If an account with this ${channel === 'sms' ? 'phone number' : 'email'} exists, an OTP was sent.\nPlease check your ${channel === 'sms' ? 'phone' : 'inbox'}.`);
                else
                    setSuccessMessage(`OTP sent to your ${channel === 'sms' ? 'phone' : 'email'}. Please check your ${channel === 'sms' ? 'messages' : 'inbox'}.`);
                setStep('otp');
                startResendTimer();
            }
            else if (response.status === 400) {
                setGeneralError(response.message || (mode === 'sign-up' ? <>
                    An account with this contact method already exists.{" "}
                    <a href="/forgot-password" className="underline">Forgot password?</a>
                </> : "Unable to send OTP. Please try again."));
            }
            else {
                setGeneralError(response.message || "Failed to send OTP. Please try again.");
            }
        } catch (err) {
            console.error('Send OTP error:', err);
            setGeneralError("Unable to connect to the server. Please check your connection.");
        } finally {
            setLoading(false);
        }
    }

    const handleVerifyOTP = async (event: React.FormEvent) => {
        event.preventDefault();
        clearErrors();

        if (!/^\d{6}$/.test(otp)) {
            setOtpError(otp ? "OTP must be 6 digits" : "Please enter the OTP");
            return;
        }

        setLoading(true);

        try {
            const response = await verifyOTP(email, otp, channel);

            if (response.status >= 200 && response.status < 300) {
                setSuccessMessage("OTP verified successfully!");
                setStep('password');
            } else {
                setGeneralError(response.message || "Invalid OTP. Please try again.");
            }
        } catch (err) {
            console.error('Verify OTP error:', err);
            setGeneralError("Unable to connect to the server. Please check your connection.");
        } finally {
            setLoading(false);
        }
    }

    const handleResetPassword = async (event: React.FormEvent) => {
        event.preventDefault();
        clearErrors();

        if (!newPassword) {
            setPasswordError("Please enter a new password");
            return;
        }

        if (newPassword.length < 8) {
            setPasswordError("Password must be at least 8 characters");
            return;
        }

        if (!confirmPassword) {
            setConfirmPasswordError("Please confirm your password");
            return;
        }

        if (newPassword !== confirmPassword) {
            setConfirmPasswordError("Passwords do not match");
            return;
        }

        setLoading(true);

        try {
            let response = null;
            if (mode === 'forgot')
                response = await resetPassword(email, otp, newPassword, channel);
            else
                response = await createAccount(email, otp, newPassword, nickname, channel);
            if (response.status >= 200 && response.status < 300) {
                if (mode === 'sign-up' && 'token' in response && response.token) {
                    const signupResponse = response as unknown as {
                        email: string;
                        nickname: string;
                        token: string;
                        isModerator: boolean;
                    };
                    await updateUser({
                        email: signupResponse.email,
                        nickname: signupResponse.nickname,
                        token: signupResponse.token,
                        isModerator: signupResponse.isModerator,
                    });
                }
                const confirmationMessage = mode === 'forgot' ? "Password reset successfully! Redirecting to login..." :
                    "Account created successfully! Redirecting to chat..."
                setSuccessMessage(confirmationMessage);
                setTimeout(() => {
                    router.push(mode === 'sign-up' ? '/chat' : '/login');
                }, 2000);
            } else {
                const failedMessage = mode === 'forgot' ? response.message || "Failed to reset password. Please try again." :
                    response.message || "Failed to create your account. Please try again.";
                setGeneralError(failedMessage);
            }
        } catch (err) {
            console.error('Reset password error:', err);
            setGeneralError("Unable to connect to the server. Please check your connection.");
        } finally {
            setLoading(false);
        }
    }

    const handleResendOTP = async () => {
        if (resendTimer > 0) return;

        clearErrors();
        setLoading(true);

        try {
            const response = await requestOTP(email, mode, channel);
            if (response.status === 200) {
                setSuccessMessage("OTP resent successfully!");
                startResendTimer();
            } else {
                setGeneralError(response.message || "Failed to resend OTP.");
            }
        } catch (err) {
            console.error('Resend OTP error:', err);
            setGeneralError("Unable to connect to the server.");
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
            <div className="mainContainer px-3 pb-[calc(4rem+var(--bottom-prompt-height))] md:p-4 md:pb-[calc(2rem+var(--bottom-prompt-height))] grid md:grid-cols-3">
                <div className='md:col-start-2 flex flex-col gap-3 md:gap-4'>
                    <div className="titleContainer">
                        <h1 className="mb-0 md:mb-0 text-3xl font-extrabold text-gray-900 dark:text-white md:text-4xl lg:text-5xl text-center">
                            <span className="text-transparent bg-clip-text bg-linear-to-r to-indigo-800 from-pink-700 dark:to-indigo-400 dark:from-pink-300">
                                {step === 'email' && mode === 'forgot' ? 'Reset Your Password' :
                                    step === 'email' && mode === 'sign-up' ? 'Create Your Account on WeCommunicate' :
                                        step === 'otp' ? 'Verify OTP' :
                                            step === 'password' && mode === 'forgot' ? 'Set New Password' :
                                                'Set Your Password'}
                            </span>
                        </h1>
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
                            {step === 'email' ? `Enter your ${channel === 'sms' ? 'phone number' : 'email'} to receive a verification code` :
                                step === 'otp' ? `Enter the 6-digit code sent to your ${channel === 'sms' ? 'phone' : 'email'}` :
                                    'Create a new password for your account'}
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
                                    aria-label="Verification method"
                                >
                                    {(['email', 'sms'] as const).map(option => (
                                        <button
                                            key={option}
                                            type="button"
                                            aria-pressed={channel === option}
                                            onClick={() => {
                                                setChannel(option);
                                                if (option === 'sms') setEmail(sanitizePhoneInput(email));
                                            }}
                                            className={`flex-1 rounded-md border py-2 text-sm font-medium transition-colors ${
                                                channel === option
                                                    ? 'border-indigo-500 bg-white text-indigo-700 shadow-sm dark:border-indigo-400 dark:bg-gray-900 dark:text-indigo-300'
                                                    : 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                                            }`}
                                        >
                                            {option === 'email' ? 'Email' : 'SMS'}
                                        </button>
                                    ))}
                                </div>
                                {mode === 'sign-up' && <input id="nickname" value={nickname} onChange={ev => setNickname(ev.target.value)} placeholder="Choose a nickname" className="inputBox mb-3 w-full" maxLength={40} required />}
                                <label htmlFor="email" className="sr-only">Email or phone number</label>
                                <input
                                    id="email"
                                    type={channel === 'email' ? 'email' : 'tel'}
                                    value={email}
                                    placeholder={channel === 'email' ? 'Enter your email' : 'Enter phone number, e.g. +972 50 123 4567'}
                                    onChange={ev => setEmail(channel === 'sms' ? sanitizePhoneInput(ev.target.value) : ev.target.value)}
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
                                    <span>Secure & private</span>
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

                                <label htmlFor="otp" className="sr-only">OTP Code</label>
                                <input
                                    id="otp"
                                    type="text"
                                    value={otp}
                                    placeholder="Enter 6-digit code"
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
                                        {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
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
                                    <label htmlFor="new-password" className="sr-only">New Password</label>
                                    <div className="relative">
                                        <input
                                            id="new-password"
                                            type={showNewPassword ? "text" : "password"}
                                            value={newPassword}
                                            placeholder={mode === 'forgot' ? "Enter new password" : "Enter password"}
                                            onChange={ev => setNewPassword(ev.target.value)}
                                            className="inputBox w-full pr-10"
                                            autoComplete="new-password"
                                            disabled={loading}
                                            aria-invalid={!!passwordError}
                                            aria-describedby={passwordError ? "password-error" : undefined}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                            aria-label={showNewPassword ? "Hide password" : "Show password"}
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
                                    <label htmlFor="confirm-password" className="sr-only">Confirm Password</label>
                                    <div className="relative">
                                        <input
                                            id="confirm-password"
                                            type={showConfirmPassword ? "text" : "password"}
                                            value={confirmPassword}
                                            placeholder={mode === 'forgot' ? "Confirm new password" : "Confirm password"}
                                            onChange={ev => setConfirmPassword(ev.target.value)}
                                            className="inputBox w-full pr-10"
                                            autoComplete="new-password"
                                            disabled={loading}
                                            aria-invalid={!!confirmPasswordError}
                                            aria-describedby={confirmPasswordError ? "confirm-password-error" : undefined}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
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
                                className="inputButton disabled:opacity-50 disabled:cursor-not-allowed w-full max-w-sm md:w-3xs mx-auto block"
                                type="submit"
                                disabled={loading}
                            >
                                {loading ? 'Processing...' :
                                    step === 'email' ? 'Send Code' :
                                        step === 'otp' ? 'Verify Code' :
                                            step === 'password' && mode === 'forgot' ? 'Reset Password' :
                                                'Create Account'}
                            </button>
                        </div>
                        {mode === 'forgot' &&
                            <p className="text-muted-foreground justify-self-center mt-4">
                                Remember your password? <a href="/login"
                                    className="font-medium text-blue-600 underline dark:text-blue-500 hover:no-underline">Back to Login</a>
                            </p>
                        }
                        {mode === 'sign-up' &&
                            <p className="text-muted-foreground justify-self-center mt-4">
                                Already have an account? <a href="/login"
                                    className="font-medium text-blue-600 underline dark:text-blue-500 hover:no-underline">Sign in</a>
                            </p>
                        }
                    </div>
                </div>
            </div>
        </form >
    );
}

export default OTPProcess;
