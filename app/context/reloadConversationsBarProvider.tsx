"use client";
import { ReactNode, useCallback, useState } from "react";
import ReloadConversationBarContext from "./reloadConversationsBarContext";
import { usePathname, useRouter } from 'next/navigation';

type ReloadConversationsProviderProps = {
    children: ReactNode;
};

export const ReloadConversationsBarProvider = ({ children }: ReloadConversationsProviderProps) => {
    const [reloadKey, setReloadKey] = useState<boolean | null | undefined>(false);
    const router = useRouter();

    const updateReloadKey = useCallback(() => {
        setReloadKey(prev => !prev);
        router.refresh();
    }, []);


    return (
        <ReloadConversationBarContext.Provider value={{ reloadKey, updateReloadKey }}>
            {children}
        </ReloadConversationBarContext.Provider>
    );
};