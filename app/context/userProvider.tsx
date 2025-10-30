"use client";
import { ReactNode, useEffect, useState, useCallback } from "react";
import User from "../types/user";
import UserContext from "./userContext";
import { fetchUser, create, del } from "../lib/cookieActions";
import AsName from "../utils/asName";

type UserProviderProps = {
    children: ReactNode;
};

export const UserProvider = ({ children }: UserProviderProps) => {
    const [user, setUser] = useState<User | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);

    const fetchUserHandler = useCallback(async () => {
        try {
            const cookieUser = await fetchUser();
            setUser(cookieUser);
        } catch (error) {
            console.error("Failed to fetch user:", error);
            setUser(null);
        } finally {
            setLoadingUser(false);
        }
    }, []);

    useEffect(() => {
        fetchUserHandler();
    }, [fetchUserHandler]);

    const updateUser = useCallback(async (userData: User | null) => {
        try {
            if (userData?.email) {
                userData = { ...userData, email: AsName(userData.email) };
            }

            setUser(userData);

            if (userData) {
                await create(userData);
            } else {
                await del();
            }
        } catch (error) {
            console.error("Failed to update user:", error);
        }
    }, []);

    return (
        <UserContext.Provider value={{ user, loadingUser, updateUser }}>
            {children}
        </UserContext.Provider>
    );
};