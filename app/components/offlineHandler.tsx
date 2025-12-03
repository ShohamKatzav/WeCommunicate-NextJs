'use client';
import { useState, useEffect, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import OfflinePage from './offlinePage';

const TARGETED_PATHS = ['/chat', '/locations'];

export default function OfflineHandler({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const [showOffline, setShowOffline] = useState(false);

    useEffect(() => {
        if (!navigator.onLine && TARGETED_PATHS.includes(pathname!)) {
            setShowOffline(true);
        } else {
            setShowOffline(false);
        }
    }, [pathname, navigator.onLine]);

    if (showOffline) return <OfflinePage />;
    return <>{children}</>;
}