"use client"
import { useContext } from "react";
import UserContext from "../context/userContext";

export const useUser = () => {
    const context = useContext(UserContext);
    if (context === undefined) throw new Error("UserContext missing!");
    return context;
};