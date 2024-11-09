"use client"
import { useRouter } from 'next/navigation';
import { useState } from "react";
import { useUser } from "../hooks/useUser";
import AxiosWithAuth from "../utils/axiosWithAuth";
import '../login/login.css';
import Loading from '../components/loading';

function SignUp() {
    const router = useRouter();
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [emailError, setEmailError] = useState("")
    const [passwordError, setPasswordError] = useState("")
    const baseUrl = process.env.NEXT_PUBLIC_BASE_ADDRESS + "api/account";
    const [loading, setLoading] = useState(false);
    const { updateUser } = useUser();


    // Call the server API to check if the given email ID already exists
    const checkAccountExists = async (callback: any) => {
        try {
            const response = await AxiosWithAuth().post(`${baseUrl}/is-exist`, { email });
            callback(response.data.accountExists);
        } catch (error: any) {
            if (error?.response?.status === 401)
                callback(false);
            else
                console.error('An unexpected error occurred', error);
            setLoading(false);
        }
    }

    // Log in a user using email and password
    const logIn = async () => {
        await AxiosWithAuth().post(`${baseUrl}/auth`, { email, password })
            .then(async response => {
                if ('Success' === response.data.message) {
                    updateUser({ email, token: response.data.token });
                    router.push("/chat");
                }
            })
            .catch(error => {
                if (error?.response?.status === 401)
                    window.alert("Wrong email or password");
                else
                    window.alert("Error occured: " + error?.response?.data?.message);
            })
            .finally(() => {
                setLoading(false);
            })

    }

    const onButtonClick = () => {

        setLoading(true);
        setEmailError("");
        setPasswordError("");

        if ("" === email) {
            setEmailError("Please enter your email")
            return
        }

        if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
            setEmailError("Please enter a valid email")
            return
        }

        if ("" === password) {
            setPasswordError("Please enter a password")
            return
        }

        if (password.length < 7) {
            setPasswordError("The password must be 8 characters or longer")
            return
        }

        checkAccountExists((accountExists: any) => {
            if (!accountExists) {
                logIn();
            }
            else
                window.alert("An account with this email is already in use");
        })

    }

    if (!loading)
        return (
            <form action={onButtonClick}>
                <div className={"mainContainer grid grid-rows-6 p-4"}>
                    <div className="titleContainer grid md:row-start-2">
                        <h1 className="mb-4 text-3xl font-extrabold text-gray-900 dark:text-white md:text-3xl lg:text-6xl text-center">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r to-indigo-700 from-pink-400">Create Your Account on WeCommunicate</span>
                        </h1>
                    </div>
                    <div className={"inputContainer row-start-2 md:row-start-4 row-span-2 space-y-4 md:grid grid-cols-6"}>
                        <input
                            value={email}
                            placeholder="Enter your email here"
                            onChange={ev => setEmail(ev.target.value)}
                            className={"inputBox w-full md:col-start-3 md:col-span-2"} />
                        <label className="errorLabel md:col-start-3 md:col-span-2">{emailError}</label>
                        <input
                            type="password"
                            value={password}
                            placeholder="Enter your password here"
                            onChange={ev => setPassword(ev.target.value)}
                            className={"inputBox w-full md:col-start-3 md:col-span-2"} />
                        <label className="errorLabel md:col-start-3 md:col-span-2">{passwordError}</label>
                    </div>
                    <div className="row-start-4 md:row-start-7 grid">
                        <div className={"inputContainer justify-self-center"}>
                            <input className={"inputButton"} type="submit" value={"Sign up"} />
                        </div>
                        <p className="text-gray-500 dark:text-gray-400 justify-self-center">Back to <a href="/login"
                            className="font-medium text-blue-600 underline dark:text-blue-500 hover:no-underline">Login</a></p>
                    </div>
                </div>
            </form>)
    else return <Loading />
}


export default SignUp;