"use client";
import { ReactNode, useEffect, useState, useCallback } from "react";
import User from "@/types/user";
import UserContext from "./userContext";
import { getCurrentUser, createUserCoockie, deleteUserCoockie } from "../lib/cookieActions";
import { getDeviceSubscription, syncDeviceSubscription } from "../lib/devicePush";

type UserProviderProps = {
    children: ReactNode;
};

export const UserProvider = ({ children }: UserProviderProps) => {
    const [user, setUser] = useState<User | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);

    const fetchUserHandler = useCallback(async () => {
        try {
            const userObject = await getCurrentUser();
            setUser(userObject);
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

    // Here rather than in PushNotificationManager (only on /chat) so the
    // device stops notifying a previous user whatever page the new one
    // lands on. Gated on loadingUser: a second server action during the
    // initial mount can cause a spurious remount.
    useEffect(() => {
        if (loadingUser || !user?.token) return;
        syncDeviceSubscription(user.token);
    }, [loadingUser, user?.token]);

    const updateUser = useCallback(async (userData: User | null) => {
        try {
            setUser(userData);

            if (userData) {
                await createUserCoockie(userData);
            } else {
                // The server drops this device's row in the same request
                // that deletes the cookie. The browser's own unsubscribe is
                // a push-service round trip, so logging out doesn't wait on it.
                const subscription = await getDeviceSubscription().catch(() => null);
                subscription?.unsubscribe().catch(error => {
                    console.error("Failed to drop push subscription:", error);
                });
                await deleteUserCoockie(subscription?.endpoint);
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
