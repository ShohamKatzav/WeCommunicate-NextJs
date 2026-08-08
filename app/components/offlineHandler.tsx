'use client';
import { useState, useEffect, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import OfflinePage from './offlinePage';

const TARGETED_PATHS = ['/chat', '/locations'];

export default function OfflineHandler({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const getInitialShowOffline = () => false;

    const [showOffline, setShowOffline] = useState<boolean>(getInitialShowOffline);

    useEffect(() => {
        const checkOnlineStatus = async () => {
            try {
                if (!navigator.onLine) {
                    setShowOffline(false);
                    return;
                }

                if (TARGETED_PATHS.includes(pathname!)) {
                    const probeUrl = `${window.location.origin}/api/health`;
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 2000);
                    try {
                        const res = await fetch(probeUrl, { method: 'GET', cache: 'no-store', signal: controller.signal });
                        clearTimeout(timeoutId);
                        if (!res.ok) {
                            setShowOffline(true);
                        } else {
                            setShowOffline(false);
                        }
                    } catch (err) {
                        clearTimeout(timeoutId);
                        setShowOffline(true);
                    }
                    return;
                }

                setShowOffline(false);
            } catch (err) {
                setShowOffline(false);
            }
        };

        checkOnlineStatus();

        const handleOnline = () => checkOnlineStatus();
        const handleOffline = () => checkOnlineStatus();

        const handleLinkClick = (e: MouseEvent) => {
            try {
                const target = e.target as HTMLElement | null;
                if (!target) return;
                const anchor = target.closest && (target.closest('a') as HTMLAnchorElement | null);
                if (!anchor || !anchor.href) return;
                const url = new URL(anchor.href, window.location.href);
                if (!url.pathname) return;
                if (!navigator.onLine && TARGETED_PATHS.includes(url.pathname)) {
                    setShowOffline(true);
                }
            } catch (err) {
                // ignore parsing/link errors
            }
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        window.addEventListener('click', handleLinkClick, true);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('click', handleLinkClick, true);
        };
    }, [pathname]);

    if (showOffline) return <OfflinePage forceOffline={true} />;
    return <>{children}</>;
}