"use client";
import { ReactNode, useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import User from "@/types/user";
import UserContext from "./userContext";
import { getCurrentUser, createUserCoockie, deleteUserCoockie } from "../lib/cookieActions";
import { dropInFlightSync, getDeviceSubscription, syncDeviceSubscription } from "../lib/devicePush";

type UserProviderProps = {
    children: ReactNode;
};

export const UserProvider = ({ children }: UserProviderProps) => {
    const [user, setUser] = useState<User | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);
    const pathname = usePathname();

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
        const token = user.token;
        syncDeviceSubscription(token);
        return () => dropInFlightSync(token);
    }, [loadingUser, user?.token, pathname]);

    const updateUser = useCallback(async (userData: User | null) => {
        try {
            if (userData) {
                // Cookie first, state second. Setting the user is what sends
                // the login page on to /chat (its effect watches user.email),
                // and proxy.ts bounces /chat back to /login without this
                // cookie. With the old order that navigation raced the cookie
                // write and could leave the login page's spinner up for good.
                await createUserCoockie(userData);
                setUser(userData);
            } else {
                // Cookie first, state second. Clearing the user is what sends
                // /chat (and the profile pages) to /login — that effect watches
                // user.token — and proxy.ts bounces /login back to /chat while
                // this cookie is still valid. With the old order that redirect
                // landed after handleLogOut's own push and left the spinner up,
                // because the effect does not run again once the token is gone.
                // The browser's own unsubscribe is a push-service round trip,
                // so logging out doesn't wait on it. The server still drops
                // this device's row in the same request that deletes the cookie,
                // which has to happen before setUser: that request needs the cookie.
                const subscription = await getDeviceSubscription().catch(() => null);
                subscription?.unsubscribe().catch(error => {
                    console.error("Failed to drop push subscription:", error);
                });
                await deleteUserCoockie(subscription?.endpoint);
                setUser(null);
            }
            return true;
        } catch (error) {
            console.error("Failed to update user:", error);
            return false;
        }
    }, []);

    return (
        <UserContext.Provider value={{ user, loadingUser, updateUser }}>
            {children}
        </UserContext.Provider>
    );
};
