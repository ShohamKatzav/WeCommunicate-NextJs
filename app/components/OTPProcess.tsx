"use client"
import '../login/login.css'
import { JSX, useState } from "react";
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { requestOTP, verifyOTP, resetPassword, createAccount } from '@/app/lib/OTPActions'

interface OTPProcessProps {
    mode: string;
}

const OTPProcess = ({ mode }: OTPProcessProps) => {
    const router = useRouter();

    const [step, setStep] = useState<'email' | 'otp' | 'password'>('email');
    const [email, setEmail] = useState("");
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

    const validateEmail = (email: string): boolean => {
        return /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email);
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

        if (!email) {
            setEmailError("Please enter your email");
            return;
        }

        if (!validateEmail(email)) {
            setEmailError("Please enter a valid email");
            return;
        }

        setLoading(true);

        try {
            const response = await requestOTP(email, mode);
            if (response.status === 200) {
                if (mode === 'forgot')
                    setSuccessMessage("If an account with this email exists, an OTP was sent.\nPlease check your inbox.");
                else
                    setSuccessMessage("OTP sent to your email. Please check your inbox.");
                setStep('otp');
                startResendTimer();
            }
            else if (response.status === 400) {
                setGeneralError(
                    <>
                        An account with this email address already exists.{" "}
                        <a href="/forgot-password" className="underline">
                            Forgot password?
                        </a>
                    </>
                );
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

        if (!otp) {
            setOtpError("Please enter the OTP");
            return;
        }

        if (otp.length !== 6) {
            setOtpError("OTP must be 6 digits");
            return;
        }

        setLoading(true);

        try {
            const response = await verifyOTP(email, otp);

            if (response.status === 200) {
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
                response = await resetPassword(email, otp, newPassword);
            else
                response = await createAccount(email, otp, newPassword);
            if (response.status === 200) {
                const confirmationMessage = mode === 'forgot' ? "Password reset successfully! Redirecting to login..." :
                    "Account created successfully! Redirecting to login..."
                setSuccessMessage(confirmationMessage);
                setTimeout(() => {
                    router.push('/login');
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
            const response = await requestOTP(email, mode);
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

    return (
        <form onSubmit={
            step === 'email' ? handleSendOTP :
                step === 'otp' ? handleVerifyOTP :
                    handleResetPassword
        }>
            <div className="mainContainer grid grid-rows-3 md:grid-rows-6 px-3 md:p-4">
                <div className="titleContainer md:row-start-2">
                    <h1 className="md:mb-4 text-3xl font-extrabold text-gray-900 dark:text-white md:text-3xl lg:text-6xl text-center">
                        <span className="text-transparent bg-clip-text bg-linear-to-r to-indigo-700 from-pink-400">
                            {step === 'email' && mode === 'forgot' ? 'Reset Your Password' :
                                step === 'email' && mode === 'sign-up' ? 'Create Your Account on WeCommunicate' :
                                    step === 'otp' ? 'Verify OTP' :
                                        step === 'password' && mode === 'forgot' ? 'Set New Password' :
                                            'Set Your Password'}
                        </span>
                    </h1>
                    <p className="text-center text-gray-600 dark:text-gray-400 mt-4 md:text-2xl text-wrap">
                        {step === 'email' ? 'Enter your email to receive a verification code' :
                            step === 'otp' ? 'Enter the 6-digit code sent to your email' :
                                'Create a new password for your account'}
                    </p>
                </div>

                {(generalError || successMessage) && (
                    <div className="row-start-2 md:row-start-3 md:grid grid-cols-5">
                        <div className={`md:col-start-2 md:col-span-3 px-4 py-3 rounded mb-4 ${successMessage
                            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 whitespace-pre-line'
                            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                            }`}>
                            {successMessage || generalError}
                        </div>
                    </div>
                )}

                <div className="inputContainer row-start-3 md:row-start-4 row-span-1 space-y-4 md:grid grid-cols-5">
                    {step === 'email' && (
                        <div className="md:col-start-2 md:col-span-3">
                            <label htmlFor="email" className="sr-only">Email</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                placeholder="Enter your email"
                                onChange={ev => setEmail(ev.target.value)}
                                className="inputBox w-full"
                                autoComplete="email"
                                disabled={loading}
                                aria-invalid={!!emailError}
                                aria-describedby={emailError ? "email-error" : undefined}
                            />
                            {emailError && (
                                <label id="email-error" className="errorLabel block mt-1">
                                    {emailError}
                                </label>
                            )}
                        </div>
                    )}
                    {step === 'otp' && (
                        <div className="md:col-start-2 md:col-span-3">
                            <label htmlFor="otp" className="sr-only">OTP Code</label>
                            <input
                                id="otp"
                                type="text"
                                value={otp}
                                placeholder="Enter 6-digit code"
                                onChange={ev => setOtp(ev.target.value.replace(/\D/g, '').slice(0, 6))}
                                className="inputBox w-full text-center text-2xl tracking-widest"
                                maxLength={6}
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
                        </div>
                    )}

                    {step === 'password' && (
                        <>
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
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                        aria-label={showNewPassword ? "Hide password" : "Show password"}
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
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
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
                        </>
                    )}
                </div>

                <div className="row-start-4 md:row-start-7 grid">
                    <div className="inputContainer justify-self-center">
                        <button
                            className="inputButton disabled:opacity-50 disabled:cursor-not-allowed w-3xs"
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
                        <p className="text-gray-500 dark:text-gray-400 justify-self-center mt-4">
                            Remember your password? <a href="/login"
                                className="font-medium text-blue-600 underline dark:text-blue-500 hover:no-underline">Back to Login</a>
                        </p>
                    }
                    {mode === 'sign-up' &&
                        <p className="text-gray-500 dark:text-gray-400 justify-self-center mt-4">
                            Already have an account? <a href="/login"
                                className="font-medium text-blue-600 underline dark:text-blue-500 hover:no-underline">Sign in</a>
                        </p>
                    }
                </div>
            </div>
        </form >
    );
}

export default OTPProcess;