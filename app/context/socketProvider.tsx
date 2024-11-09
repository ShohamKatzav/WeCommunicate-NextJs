"use client";
import { ReactNode, useEffect, useState } from "react";
import io, { Socket } from 'socket.io-client';
import { useUser } from "../hooks/useUser";
import SocketContext from "./socketContext";

type SocketProviderProps = {
    children: ReactNode;
};

export const SocketProvider = ({ children }: SocketProviderProps) => {
    const baseAddress = process.env.NEXT_PUBLIC_BASE_ADDRESS as string;
    const { user, loading } = useUser();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [loadingSocket, setLoadingSocket] = useState(true);

    useEffect(() => {
        if (!loading && user?.email) {
            const setUp = () => {
                const socketConfig = {
                    extraHeaders: {
                        "email": user.email as string
                    },
                    autoConnect: false,
                    reconnection: true,
                    reconnectionAttempts: 5,
                    reconnectionDelay: 10000,
                    reconnectionDelayMax: 10000,
                    path: "/api/socket",
                    auth: {
                        token: user?.token
                    }
                }
                const newSocket = io(baseAddress, socketConfig);
                newSocket.connect();
                setSocket(newSocket);
                setLoadingSocket(false);
            }
            setUp();
        }
        return () => {
            if (socket?.active) { // <-- This is important
                socket.disconnect();
            }
        };

    }, [user?.token]);

    return (
        <SocketContext.Provider value={{ socket, loadingSocket }}>
            {children}
        </SocketContext.Provider>
    );
}