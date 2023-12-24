"use client"
import { ReactNode, useEffect, useState } from "react";
import User from "../types/user";
import UserContext from "./userContext";
import { create, del } from "../actions/cookie-actions";
import FetchUserData from "../utils/fetchUserData";
import AsName from "../utils/asName";

type UserProviderProps = {
    children: ReactNode;
};

export const UserProvider = ({ children }: UserProviderProps) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        const init = async () => {
            await fetchUser();
        };
        init();       
    }, []);

    const fetchUser = async () => {
        const cookieUser = await FetchUserData();
        if (cookieUser) {
            setUser(cookieUser);
        }
        setLoading(false);
    };

    const updateUser = async (userData: User | null) => {
        if(userData?.email)
            userData.email = AsName(userData?.email!);
        setUser(userData);
        if (userData)
            await create(userData);
        else
            await del();
    };

    return (
        <UserContext.Provider value={{ user, updateUser, loading }}>
            {children}
        </UserContext.Provider>
    );
};