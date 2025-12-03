'use client';
import { useState, useEffect, ReactNode, useCallback } from 'react';
import OfflinePage from './offlinePage';

export default function OfflineHandler({ children }: { children: ReactNode }) {
    const [offlinePageVisible, setOfflinePageVisible] = useState(false);

    const handleNavigationAttempt = useCallback((e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const navTarget = target.closest('[href]') as HTMLAnchorElement | null;

        if (!navTarget) {
            return;
        }
        if (!navigator.onLine) {
            setOfflinePageVisible(true);
        }

    }, []);

    useEffect(() => {
        document.addEventListener('click', handleNavigationAttempt, true);
        return () => {
            document.removeEventListener('click', handleNavigationAttempt, true);
        };
    }, [handleNavigationAttempt]);

    if (offlinePageVisible) {
        return <OfflinePage />;
    }

    return <>{children}</>;
}