import { useSyncExternalStore } from "react";

// Which message currently has its actions open (the mobile action menu, or
// the desktop reaction picker). Module-level rather than per-bubble state so
// opening one closes whichever was open before - the bubbles are rendered by
// both ChatWindow and MoreMessagesLoader, so a parent-owned value would have
// to be threaded through two separate lists to get the same effect.
let activeMessageId: string | null = null;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
};

export const setActiveMessage = (id: string | null) => {
    if (activeMessageId === id) return;
    activeMessageId = id;
    listeners.forEach(listener => listener());
};

export const clearActiveMessage = (id: string) => {
    if (activeMessageId === id) setActiveMessage(null);
};

export const useIsActiveMessage = (id: string | undefined) =>
    useSyncExternalStore(
        subscribe,
        () => id != null && activeMessageId === id,
        () => false
    );
