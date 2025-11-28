"use client";
import { useContext } from "react";
import SocketContext from "../context/socketContext";

export const useSocket = () => {
    const context = useContext(SocketContext);
    if (!context) throw new Error("UserContext missing!");
    return context;
};