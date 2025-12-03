'use client';
import { useState, useEffect, useCallback, ReactNode } from 'react';
import OfflinePage from './offlinePage';

const TARGETED_PATHS = ['/chat', '/locations'];

export default function OfflineHandler({ children }: { children: ReactNode }) {
    const [showOffline, setShowOffline] = useState(false);

    const handleLinkClick = useCallback((e: MouseEvent) => {
        const link = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null;
        if (!link) return;

        const href = link.getAttribute('href');
        if (!href) return;

        if (TARGETED_PATHS.includes(href) && !navigator.onLine) {
            e.preventDefault();
            setShowOffline(true);
        }
    }, []);

    useEffect(() => {
        document.addEventListener('click', handleLinkClick, true);
        return () => document.removeEventListener('click', handleLinkClick, true);
    }, [handleLinkClick]);

    if (showOffline) return <OfflinePage />;

    return <>{children}</>;
}