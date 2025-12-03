'use client';
import { useState, useEffect, ReactNode, useCallback } from 'react';
import OfflinePage from './offlinePage';

export default function OfflineHandler({ children }: { children: ReactNode }) {
    const [offlinePageVisible, setOfflinePageVisible] = useState(false);
    const TARGETED_PATHS = ['/chat', '/locations'];

    const handleNavigationAttempt = useCallback((e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const navTarget = target.closest('a[href]') as HTMLAnchorElement | null;
        if (!navTarget) return;

        const targetLink = navTarget.getAttribute('href');
        if (!targetLink) return;

        const isTargeted = TARGETED_PATHS.includes(targetLink);

        if (isTargeted && !navigator.onLine) {
            e.preventDefault();
            setOfflinePageVisible(true);
        }
    }, []);

    useEffect(() => {
        document.addEventListener('click', handleNavigationAttempt, true);
        return () => document.removeEventListener('click', handleNavigationAttempt, true);
    }, [handleNavigationAttempt]);

    if (offlinePageVisible) {
        return <OfflinePage />;
    }

    return <>{children}</>;
}