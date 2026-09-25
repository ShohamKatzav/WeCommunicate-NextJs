import { useState, useEffect } from 'react';
import { toast } from "sonner";
import { useT } from "../../i18n/client";
import { pageTitleSizeClassName } from "../shell/pageTitle";

const bold = (chunk: string) => <strong>{chunk}</strong>;

export default function OfflinePage({ forceOffline }: { forceOffline?: boolean }) {
    const t = useT();
    const [isOnline, setIsOnline] = useState(() => {
        if (forceOffline) return false;
        return navigator.onLine;
    });

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const handleRetry = () => {
        if (navigator.onLine) {
            window.location.href = '/chat';
        } else {
            toast.error(t("offline.stillOffline"));
        }
    };

    const handleGoBack = () => {
        window.history.back();
    };

    return (
        // Was permanently dark (from-gray-900 to-slate-900, no dark: pair) -
        // this page is rendered inside the app's real ThemeProvider (see
        // offlineHandler.tsx in layout.tsx), so .dark toggling already
        // worked here; it just never had a light-mode look to switch to.
        // Same gradient stops as public/offline.html's light/dark pair.
        <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 to-sky-100 dark:from-gray-900 dark:to-slate-800 text-gray-800 dark:text-gray-50 flex flex-col items-center justify-center text-center px-6 relative z-50">
            {/* Status Icon */}
            <div className={`w-24 h-24 ${isOnline ? 'animate-pulse' : 'animate-bounce'}`}>
                {isOnline ? (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        // text-success: the plain green-400 this used to be
                        // is under the 3:1 non-text contrast minimum against
                        // the new light background (computed ~1.5:1) - this
                        // token is the same one already audited for exactly
                        // this "obvious shade fails" case (see globals.css).
                        className="w-full h-full text-success"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                        />
                    </svg>
                ) : (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        className="w-full h-full text-muted-foreground"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2 12h20M2 6h20M2 18h20"
                        />
                    </svg>
                )}
            </div>

            {/* Status Text - Reduced size for better mobile fit */}
            <h1 className={`mt-6 ${pageTitleSizeClassName}`}>
                {isOnline ? t("offline.backOnline") : t("offline.offline")}
            </h1>

            {/* Description */}
            <p className="mt-4 text-base sm:text-lg">
                {isOnline ? t.rich("offline.restored", { b: bold }) : t.rich("offline.lost", { b: bold })}
            </p>

            <p className="mt-2 text-sm italic text-muted-foreground">
                {t("offline.quote")}
            </p>

            {/* Connection Indicator */}
            <div
                className={`mt-6 px-4 py-2 rounded-full font-medium inline-block ${isOnline
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}
            >
                {isOnline ? t("offline.connected") : t("offline.noConnection")}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 mt-8 w-full max-w-sm">
                <button
                    onClick={handleRetry}
                    className="flex-1 w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all duration-200 text-base"
                >
                    {t("offline.retry")}
                </button>
                <button
                    onClick={handleGoBack}
                    className="flex-1 w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-100 font-semibold rounded-xl border border-gray-600 transition-all duration-200 text-base"
                >
                    {t("offline.goBack")}
                </button>
            </div>

            {/* Helpful Tips */}
            <ul className="mt-12 list-disc text-start max-w-xs ps-5 space-y-2">
                <li>{t("offline.tipWifi")}</li>
                <li>{t("offline.tipAirplane")}</li>
                <li>{t("offline.tipCached")}</li>
            </ul>
        </div>
    );
}