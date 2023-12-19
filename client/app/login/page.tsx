"use client"
import './login.css'
import React, { useState } from "react";
import { useRouter } from 'next/navigation';
import { create } from '../utils/cookie-actions';
import AxiosWithAuth from '../utils/AxiosWithAuth';

const Login = (props: any) => {
  const router = useRouter();
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [emailError, setEmailError] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const baseUrl = process.env.NEXT_PUBLIC_BASE_PATH;


  // Call the server API to check if the given email ID already exists
  const checkAccountExists = async (callback: any) => {
    const response = await AxiosWithAuth().post(`${baseUrl}/check-account`, { email });
    callback(response.data.userExists);
  }

  // Log in a user using email and password
  const logIn = async () => {
    await AxiosWithAuth().post(`${baseUrl}/auth`, { email, password })
      .then(async response => {
        if ('success' === response.data.message) {
          await create({ email, token: response.data.token });
          props.setLoggedIn(true)
          props.setEmail(email)
          router.push("/chat");
        }
      })
      .catch(error => {
        if (error.response.status === 401)
          window.alert("Wrong email or password");
        else
          window.alert("Error occured: " + error.response.data.message);
      })

  }

  const onButtonClick = () => {
    // Set initial error values to empty
    setEmailError("")
    setPasswordError("")

    // Check if the user has entered both fields correctly
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
      // If yes, log in 
      if (accountExists)
        logIn()
      else
        // Else, ask user if they want to create a new account and if yes, then log in
        if (window.confirm("An account does not exist with this email address: " + email + ". Do you want to create a new account?")) {
          logIn()
        }
    })

  }

  return (
    <div className={"mainContainer grid grid-rows-6"}>
      <div className="titleContainer grid row-start-2">
        <h1 className="mb-4 text-3xl font-extrabold text-gray-900 dark:text-white md:text-3xl lg:text-6xl text-center">
          <span className="text-transparent bg-clip-text bg-gradient-to-r to-indigo-700 from-pink-400">Login to WeCommunicate</span>
        </h1>
      </div>
      <div className={"inputContainer row-start-3 md:row-start-4 justify-self-center w-5/6"}>
        <input
          value={email}
          placeholder="Enter your email here"
          onChange={ev => setEmail(ev.target.value)}
          className={"inputBox w-full"} />
        <label className="errorLabel">{emailError}</label>
      </div>
      <div className={"inputContainer row-start-4 md:row-start-5 justify-self-center w-5/6"}>
        <input
          value={password}
          placeholder="Enter your password here"
          onChange={ev => setPassword(ev.target.value)}
          className={"inputBox w-full"} />
        <label className="errorLabel">{passwordError}</label>
      </div>
      <div className={"inputContainer row-start-5 md:row-start-7 justify-self-center"}>
        <input
          className={"inputButton"}
          type="button"
          onClick={onButtonClick}
          value={"Log in"} />
      </div>
    </div>)
}
export default Login;
