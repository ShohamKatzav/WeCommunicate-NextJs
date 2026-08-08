'use client';
import { useState, useEffect, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import OfflinePage from './offlinePage';

const TARGETED_PATHS = ['/chat', '/locations', '/moderator'];

const isTargetedPath = (path?: string) => {
    if (!path) return false;
    const normalized = path.startsWith('/') ? path : `/${path}`;
    const cleaned = normalized.split('?')[0].split('#')[0].replace(/\/+$/, '');
    return TARGETED_PATHS.some(target => cleaned === target || cleaned.startsWith(`${target}/`));
};

export default function OfflineHandler({ children }: { children: ReactNode }) {
    const pathname = usePathname() || undefined;
    const getInitialShowOffline = () => typeof window !== 'undefined' && !navigator.onLine && isTargetedPath(window.location.pathname);
    const [showOffline, setShowOffline] = useState<boolean>(getInitialShowOffline);

    useEffect(() => {
        const checkOnlineStatus = async () => {
            try {
                if (!navigator.onLine) {
                    setShowOffline(isTargetedPath(pathname));
                    return;
                }

                if (isTargetedPath(pathname)) {
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

        // Going offline while already using chat/locations is an expected
        // application state: those pages queue actions locally. Do not
        // replace the current page just because the connection was lost.
        const handleOnline = () => setShowOffline(false);
        const handleOffline = () => {
            // A route transition that is already in progress is handled by
            // the link capture listener below. This event must not tear down
            // an active offline-capable page.
            return;
        };

        const handleLinkClick = (e: MouseEvent) => {
            try {
                const target = e.target as HTMLElement | null;
                if (!target) return;
                const anchor = target.closest && (target.closest('a') as HTMLAnchorElement | null);
                if (!anchor || !anchor.href) return;
                const url = new URL(anchor.href, window.location.href);
                if (!isTargetedPath(url.pathname)) return;

                // Capture targeted links before Next handles them as an RSC
                // navigation. A failed RSC request otherwise leaves the old
                // page's loading UI visible indefinitely while offline.
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                const goOffline = () => window.location.replace('/offline.html');
                if (!navigator.onLine) {
                    goOffline();
                    return;
                }

                const controller = new AbortController();
                const timeoutId = window.setTimeout(() => controller.abort(), 1000);
                fetch('/api/health', {
                    method: 'GET',
                    cache: 'no-store',
                    signal: controller.signal,
                })
                    .then((response) => {
                        if (!response.ok) throw new Error('Health check failed');
                        window.location.assign(url.href);
                    })
                    .catch(goOffline)
                    .finally(() => window.clearTimeout(timeoutId));
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
