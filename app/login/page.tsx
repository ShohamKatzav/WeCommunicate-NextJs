"use client"
import './login.css'
import { useState } from "react";
import { useRouter } from 'next/navigation';
import { useUser } from '../hooks/useUser';
import Loading from '../components/loading';
import { isExist, authenticateUser } from '@/app/lib/accountActions'

const Login = () => {
  const router = useRouter();
  const { user, loadingUser, updateUser } = useUser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [loading, setLoading] = useState(false);

  // Check if account exists
  const checkAccountExists = async (): Promise<boolean> => {
    try {
      const response = await isExist(email);
      return response.accountExists;
    } catch (err: any) {
      if (err.response?.status === 401) window.alert("Wrong email or password");
      return false;
    }
  }

  // Log in user
  const logIn = async () => {
    try {
      const response = await authenticateUser(email, password);
      if (response.success) {
        await updateUser({ email, token: response.token });
        router.push("/chat");
      }
      else
        if (response.status === 401)
          window.alert("Wrong email or password");
    } catch (err: any) {
      console.error('Unexpected error', err);
    } finally {
      setLoading(false);
    }
  }

  // Validate inputs and handle login
  const onButtonClick = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setEmailError("");
    setPasswordError("");

    if (!email) {
      setEmailError("Please enter your email");
      setLoading(false);
      return;
    }

    if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
      setEmailError("Please enter a valid email");
      setLoading(false);
      return;
    }

    if (!password) {
      setPasswordError("Please enter a password");
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setPasswordError("The password must be 8 characters or longer");
      setLoading(false);
      return;
    }

    const accountExists = await checkAccountExists();
    if (accountExists) await logIn();
    else setLoading(false);
  }

  if (user && Object.keys(user).length < 0 || loadingUser || loading)
    return <Loading />;

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

        <div className="inputContainer row-start-2 md:row-start-4 row-span-2 space-y-4 md:grid grid-cols-5">
          <input
            value={email}
            placeholder="Enter your email here"
            onChange={ev => setEmail(ev.target.value)}
            className="inputBox w-full md:col-start-2 md:col-span-3"
          />
          <label className="errorLabel md:col-start-2 md:col-span-3">{emailError}</label>

          <input
            type="password"
            value={password}
            placeholder="Enter your password here"
            onChange={ev => setPassword(ev.target.value)}
            className="inputBox w-full md:col-start-2 md:col-span-3"
          />
          <label className="errorLabel md:col-start-2 md:col-span-3">{passwordError}</label>
        </div>

        <div className="row-start-4 md:row-start-7 grid">
          <div className="inputContainer justify-self-center">
            <input className="inputButton" type="submit" value="Log in" />
          </div>
          <p className="text-gray-500 dark:text-gray-400 justify-self-center">
            Not a Member? <a href="/sign-up"
              className="font-medium text-blue-600 underline dark:text-blue-500 hover:no-underline">Sign up!</a>
          </p>
        </div>
      </div>
    </form>
  );
}

export default Login;