'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

// conversationId -> the ISO clearedAt captured at click time. Only ever
// populated by an offline Clear Room History (see chatDropdown.tsx) - the
// online path never leaves a local record behind, since the server cutoff
// already exists the moment that call resolves.
export type PendingClears = Record<string, string>;

const storageKey = (userEmail: string) => `wecommunicate_pending_clean:${userEmail.toUpperCase()}`;

const readStore = (userEmail: string): PendingClears => {
    try {
        const raw = localStorage.getItem(storageKey(userEmail));
        return raw ? JSON.parse(raw) : {};
    } catch {
        // Private browsing / storage disabled - a reload before the offline
        // queue flushes just won't be able to keep hiding the history.
        return {};
    }
};

const writeStore = (userEmail: string, value: PendingClears) => {
    try {
        localStorage.setItem(storageKey(userEmail), JSON.stringify(value));
    } catch {
        // Not fatal - see readStore's comment.
    }
};

// Persisted (survives a reload before the offline queue flushes - /chat is
// in NEVER_CACHE, so a reload while offline hits offline.html and the next
// online load would otherwise rehydrate from the server before the queue has
// had a chance to sync) and scoped to the signed-in user. Exposes both
// reactive state (for components that need to re-render, e.g. the bar list
// and MoreMessagesLoader's page reset) and a ref mirror (for callbacks that
// read it fresh without wanting to churn their own identity on every
// change - the same convention chatRef/currentConversationId already use).
export const usePendingCleanHistory = (userEmail?: string) => {
    const [pendingClears, setPendingClearsState] = useState<PendingClears>({});
    const pendingClearsRef = useRef<PendingClears>({});

    useEffect(() => {
        const next = userEmail ? readStore(userEmail) : {};
        pendingClearsRef.current = next;
        setPendingClearsState(next);
    }, [userEmail]);

    const setPendingClear = useCallback((conversationId: string, clearedAt: string) => {
        if (!userEmail || !conversationId) return;
        const next = { ...pendingClearsRef.current, [conversationId]: clearedAt };
        pendingClearsRef.current = next;
        writeStore(userEmail, next);
        setPendingClearsState(next);
    }, [userEmail]);

    const clearPendingClear = useCallback((conversationId: string) => {
        if (!userEmail || !conversationId) return;
        if (!(conversationId in pendingClearsRef.current)) return;
        const next = { ...pendingClearsRef.current };
        delete next[conversationId];
        pendingClearsRef.current = next;
        writeStore(userEmail, next);
        setPendingClearsState(next);
    }, [userEmail]);

    return { pendingClears, pendingClearsRef, setPendingClear, clearPendingClear };
};
