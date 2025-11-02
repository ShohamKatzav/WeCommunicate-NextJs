"use client"
import { useRouter } from 'next/navigation';
import { useState } from "react";
import { useUser } from "../hooks/useUser";
import '../login/login.css';
import Loading from '../components/loading';
import { isExist, createUser } from '@/app/lib/accountActions'
import { Eye, EyeOff } from 'lucide-react';

function SignUp() {
    const router = useRouter();
    const { loadingUser, updateUser } = useUser();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [emailError, setEmailError] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [confirmPasswordError, setConfirmPasswordError] = useState("");
    const [generalError, setGeneralError] = useState("");
    const [loading, setLoading] = useState(false);

    const validateEmail = (email: string): boolean => {
        return /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email);
    }

    const validatePassword = (password: string): boolean => {
        return password.length >= 8;
    }

    const clearErrors = () => {
        setEmailError("");
        setPasswordError("");
        setConfirmPasswordError("");
        setGeneralError("");
    }

    const validateInputs = (): boolean => {
        clearErrors();
        let isValid = true;

        if (!email) {
            setEmailError("Please enter your email");
            isValid = false;
        } else if (!validateEmail(email)) {
            setEmailError("Please enter a valid email");
            isValid = false;
        }

        if (!password) {
            setPasswordError("Please enter a password");
            isValid = false;
        } else if (!validatePassword(password)) {
            setPasswordError("The password must be 8 characters or longer");
            isValid = false;
        }

        if (!confirmPassword) {
            setConfirmPasswordError("Please confirm your password");
            isValid = false;
        } else if (password !== confirmPassword) {
            setConfirmPasswordError("Passwords do not match");
            isValid = false;
        }

        return isValid;
    }

    const handleSignUp = async () => {
        try {
            const existsResponse = await isExist(email);

            if (existsResponse.accountExists) {
                setGeneralError("An account with this email already exists. Please log in instead.");
                return false;
            }

            const createResponse = await createUser(email, password);

            if (createResponse.success) {
                await updateUser({ email, token: createResponse.token });
                router.replace('/chat');
                return true;
            } else {
                setGeneralError("Failed to create account. Please try again.");
                return false;
            }
        } catch (err: any) {
            console.error('Sign up error:', err);

            if (err.response?.status === 409) {
                setGeneralError("An account with this email already exists.");
            } else {
                setGeneralError("Unable to connect to the server. Please check your connection.");
            }

            return false;
        }
    }

    const onButtonClick = async (event: React.FormEvent) => {
        event.preventDefault();

        if (loading) return;

        if (!validateInputs()) {
            return;
        }

        setLoading(true);
        await handleSignUp();
        setLoading(false);
    }

    if (loadingUser) {
        return <Loading />;
    }

    return (
        <form onSubmit={onButtonClick}>
            <div className="mainContainer grid grid-rows-6 p-4">
                <div className="titleContainer md:row-start-2">
                    <h1 className="mb-4 text-3xl font-extrabold text-gray-900 dark:text-white md:text-3xl lg:text-6xl text-center">
                        <span className="text-transparent bg-clip-text bg-linear-to-r to-indigo-700 from-pink-400">
                            Create Your Account on WeCommunicate
                        </span>
                    </h1>
                </div>

                {generalError && (
                    <div className="row-start-2 md:row-start-3 md:grid grid-cols-5">
                        <div className="md:col-start-2 md:col-span-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded mb-4">
                            {generalError}
                        </div>
                    </div>
                )}

                <div className="inputContainer row-start-2 md:row-start-4 row-span-2 space-y-4 md:grid grid-cols-5">
                    <div className="md:col-start-2 md:col-span-3">
                        <label htmlFor="email" className="sr-only">Email</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            placeholder="Enter your email here"
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

                    <div className="md:col-start-2 md:col-span-3">
                        <label htmlFor="password" className="sr-only">Password</label>
                        <div className="relative">
                            <input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                placeholder="Enter your password here"
                                onChange={ev => setPassword(ev.target.value)}
                                className="inputBox w-full pr-10"
                                autoComplete="new-password"
                                disabled={loading}
                                aria-invalid={!!passwordError}
                                aria-describedby={passwordError ? "password-error" : undefined}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                aria-label={showPassword ? "Hide password" : "Show password"}
                                disabled={loading}
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
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
                                placeholder="Confirm your password"
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
                </div>

                <div className="row-start-4 md:row-start-7 grid">
                    <div className="inputContainer justify-self-center">
                        <button
                            className="inputButton disabled:opacity-50 disabled:cursor-not-allowed"
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? "Creating account..." : "Sign up"}
                        </button>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 justify-self-center mt-4">
                        Already have an account? <a href="/login"
                            className="font-medium text-blue-600 underline dark:text-blue-500 hover:no-underline">Log in!</a>
                    </p>
                </div>
            </div>
        </form>
    );
}

export default SignUp;