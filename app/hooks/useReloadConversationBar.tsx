"use client"
import { useContext } from "react";
import ReloadConversationBarContext from "../context/reloadConversationsBarContext";


export const useReloadConversationBar = () => {
    const context = useContext(ReloadConversationBarContext);
    if (context === undefined) {
        throw new Error('useReloadConversationBar must be used within a UseReloadConversationBarProvider');
    }
    return context;
};