"use client"
import './login.css'
import { useState } from "react";
import { useRouter } from 'next/navigation';
import { useUser } from '../hooks/useUser';
import Loading from '../components/loading';
import { isExist, authenticateUser } from '@/app/lib/accountActions'
import { Eye, EyeOff } from 'lucide-react';

const Login = () => {
  const router = useRouter();
  const { loadingUser, updateUser } = useUser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
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

    return isValid;
  }

  const handleLogin = async () => {
    try {
      // Check if account exists
      const existsResponse = await isExist(email);

      if (!existsResponse.accountExists) {
        setGeneralError("No account found with this email. Please sign up first.");
        return false;
      }

      // Authenticate user
      const authResponse = await authenticateUser(email, password);

      if (authResponse.success) {
        await updateUser({ email, token: authResponse.token });
        router.push("/chat");
        return true;
      } else if (authResponse.status === 401) {
        setGeneralError("Wrong email or password. Please try again.");
        return false;
      } else {
        setGeneralError("An unexpected error occurred. Please try again.");
        return false;
      }
    } catch (err: any) {
      console.error('Login error:', err);

      if (err.response?.status === 401) {
        setGeneralError("Wrong email or password. Please try again.");
      } else {
        setGeneralError("Unable to connect to the server. Please check your connection.");
      }

      return false;
    }
  }

  // Handle form submission
  const onButtonClick = async (event: React.FormEvent) => {
    event.preventDefault();

    if (loading) return;

    if (!validateInputs()) {
      return;
    }

    setLoading(true);
    await handleLogin();
    setLoading(false);
  }

  // Show loading screen only for initial user check
  if (loadingUser) {
    return <Loading />;
  }

  return (
    <form onSubmit={onButtonClick}>
      <div className="mainContainer grid grid-rows-6 p-4">
        <div className="titleContainer md:row-start-2">
          <h1 className="mb-4 text-3xl font-extrabold text-gray-900 dark:text-white md:text-3xl lg:text-6xl text-center">
            <span className="text-transparent bg-clip-text bg-linear-to-r to-indigo-700 from-pink-400">
              Login to WeCommunicate
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
                autoComplete="current-password"
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

        </div>

        <div className="row-start-4 md:row-start-7 grid">
          <div className="inputContainer justify-self-center">
            <button
              className="inputButton disabled:opacity-50 disabled:cursor-not-allowed"
              type="submit"
              disabled={loading}
            >
              {loading ? "Logging in..." : "Log in"}
            </button>
          </div>
          <p className="text-gray-500 dark:text-gray-400 justify-self-center mt-4">
            Not a Member? <a href="/sign-up"
              className="font-medium text-blue-600 underline dark:text-blue-500 hover:no-underline">Sign up!</a>
          </p>
        </div>
      </div>
    </form>
  );
}

export default Login;