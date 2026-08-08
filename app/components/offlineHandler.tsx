'use client';
import { useState, useEffect, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import OfflinePage from './offlinePage';

const TARGETED_PATHS = ['/chat', '/locations'];

export default function OfflineHandler({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const [showOffline, setShowOffline] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const checkOnlineStatus = () => {
            if (!navigator.onLine && TARGETED_PATHS.includes(pathname!)) {
                setShowOffline(true);
            } else {
                setShowOffline(false);
            }
        };

        // initial check when pathname or effect runs
        checkOnlineStatus();

        // update when online/offline events fire (handles runtime changes)
        const handleOnline = () => checkOnlineStatus();
        const handleOffline = () => checkOnlineStatus();

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [pathname]);

    if (showOffline) return <OfflinePage />;
    return <>{children}</>;
}