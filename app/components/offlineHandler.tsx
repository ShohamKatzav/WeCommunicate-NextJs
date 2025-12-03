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
        checkOnlineStatus();
    }, [pathname]);

    if (showOffline) return <OfflinePage />;
    return <>{children}</>;
}