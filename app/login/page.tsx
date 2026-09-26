"use client"
import './login.css'
import { useEffect, useState } from "react";
import { useRouter } from 'next/navigation';
import { useUser } from '../hooks/useUser';
import Loading from '../components/ui/loading';
import { isExist, authenticateUser } from '@/app/lib/accountActions'
import { Eye, EyeOff } from 'lucide-react';
import { useT } from '../i18n/client';
import { pageTitleClassName } from '../components/shell/pageTitle';
import PageTitle from '../components/shell/fitTitle';

const Login = () => {
  const router = useRouter();
  const { user, loadingUser, updateUser } = useUser();
  const t = useT();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [loading, setLoading] = useState(false);

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || /^\+[1-9]\d{7,14}$/.test(email.replace(/[\s()-]/g, ''));
  }

  const validatePassword = (password: string): boolean => {
    return password.length >= 8;
  }

  useEffect(() => {
    if (!loadingUser && user?.email) {
      router.replace("/chat");
    }
  }, [loadingUser, router, user?.email]);

  const clearErrors = () => {
    setEmailError("");
    setPasswordError("");
    setGeneralError("");
  }

  const validateInputs = (): boolean => {
    clearErrors();
    let isValid = true;

    if (!email) {
      setEmailError(t("auth.login.enterIdentifier"));
      isValid = false;
    } else if (!validateEmail(email)) {
      setEmailError(t("auth.login.invalidIdentifier"));
      isValid = false;
    }

    if (!password) {
      setPasswordError(t("auth.login.enterPassword"));
      isValid = false;
    } else if (!validatePassword(password)) {
      setPasswordError(t("auth.login.passwordTooShort"));
      isValid = false;
    }

    return isValid;
  }

  const handleLogin = async () => {
    try {
      // Check if account exists
      const existsResponse = await isExist(email);

      if (!existsResponse.accountExists) {
        setGeneralError(t("auth.login.wrongCredentials"));
        return false;
      }

      // Authenticate user
      const authResponse = await authenticateUser(email, password);
      if (await authResponse.success) {
        const saved = await updateUser({ email: authResponse.email, nickname: authResponse.nickname, token: authResponse.token, isModerator: authResponse.isModerator, avatarUrl: authResponse.avatarUrl, accentColor: authResponse.accentColor, locale: authResponse.locale });
        if (!saved) {
          setGeneralError(t("auth.cannotConnect"));
          return false;
        }
        // No router.replace here: the effect above navigates to /chat as
        // soon as the user is set, which updateUser only does once the
        // cookie is written. A second replace would just discard that one.
        return true;
      } else if (authResponse.status === 401) {
        setGeneralError(t("auth.login.wrongCredentials"));
        return false;
      } else if (authResponse.status === 403) {
        setGeneralError(authResponse.message ?? t("auth.login.unavailable"));
      } else if (authResponse.status === 429) {
        setGeneralError(authResponse.message ?? t("auth.login.tooManyAttempts"));
        return false;
      } else {
        setGeneralError(t("auth.login.unexpected"));
        return false;
      }
    } catch (err: any) {
      console.error('Login error:', err);

      if (err.response?.status === 401) {
        setGeneralError(t("auth.login.wrongCredentials"));
      } else {
        setGeneralError(t("auth.cannotConnect"));
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
    const loginSucceeded = await handleLogin();
    if (!loginSucceeded) {
      setLoading(false);
    }
  }

  if (loadingUser || loading || user?.email) {
    return <Loading />;
  }

  return (
    <form onSubmit={onButtonClick}>
      <div className="mainContainer px-4 pb-[calc(4rem+var(--bottom-prompt-height))] md:pb-[calc(2rem+var(--bottom-prompt-height))]">
        <div className="titleContainer">
          <PageTitle className={`${pageTitleClassName} mb-4`}>
            <span className="text-transparent bg-clip-text bg-linear-to-r to-indigo-800 from-pink-700 dark:to-indigo-400 dark:from-pink-300">
              {t("auth.login.title")}
            </span>
          </PageTitle>
        </div>

        {generalError && (
          <div className="row-start-2 md:row-start-1 md:mt-5">
            <div className="mx-auto max-w-2xl
                          border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded mb-4">
              {generalError}
            </div>
          </div>
        )}
        <div className={`inputContainer space-y-4 grid lg:grid-cols-5 md:grid-cols-3 ${generalError ? 'row-start-2' : 'row-start-1 mt-10 md:mt-20'}`}>
          <div className="md:col-start-2 lg:col-start-3 md:col-span-1">
            <label htmlFor="email" className="sr-only">{t("auth.login.identifier")}</label>
            {/* An address or "+972 50 ..." stays left to right in a right-to-left
                page, or the digit groups of a phone number come out reversed.
                Only once there's something in it: empty, the placeholder
                follows the page. */}
            <input
              id="email"
              type="text"
              dir={email ? "ltr" : undefined}
              value={email}
              placeholder={t("auth.login.identifier")}
              onChange={ev => setEmail(ev.target.value)}
              className="inputBox w-full"
              autoComplete="username"
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

          <div className="md:col-start-2 lg:col-start-3 md:col-span-1">
            <label htmlFor="password" className="sr-only">{t("auth.login.password")}</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                placeholder={t("auth.login.passwordPlaceholder")}
                onChange={ev => setPassword(ev.target.value)}
                className="inputBox w-full pe-10"
                autoComplete="current-password"
                disabled={loading}
                aria-invalid={!!passwordError}
                aria-describedby={passwordError ? "password-error" : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
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

          <div className={`md:col-start-2 lg:col-start-3 md:col-span-3 flex items-center justify-between ${generalError ? 'row-start-4' : 'row-start-3'}`}>
            <a
              href="/forgot-password"
              className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-500"
            >
              {t("auth.login.forgotPassword")}
            </a>
          </div>
        </div>

        <div className={`mt-5 ${generalError ? 'row-start-4' : 'row-start-3'}`}>
          <div className="inputContainer justify-self-center">
            <button
              className="inputButton disabled:opacity-50 disabled:cursor-not-allowed"
              type="submit"
              disabled={loading}
            >
              {loading ? t("auth.login.submitting") : t("auth.login.submit")}
            </button>
          </div>
          <p className="text-muted-foreground justify-self-center mt-4">
            {t("auth.login.notMember")} <a href="/sign-up"
              className="font-medium text-blue-600 underline dark:text-blue-500 hover:no-underline">{t("auth.login.signUp")}</a>
          </p>
        </div>
      </div>
    </form>
  );
}

export default Login;
