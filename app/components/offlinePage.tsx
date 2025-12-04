import React, { useState, useEffect } from 'react';

export default function OfflinePage() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

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
            alert("Still offline. Please check your connection.");
        }
    };

    const handleGoBack = () => {
        window.history.back();
    };

    return (
        // 1. ADD z-index: z-50 to ensure it's on top of PWA install banners.
        // 2. Add fixed positioning (or h-screen/min-h-screen) to ensure full coverage.
        <div className="min-h-screen w-full bg-gradient-to-br from-gray-900 to-slate-900 text-gray-50 flex flex-col items-center justify-center text-center px-6 relative z-50">
            {/* Status Icon */}
            <div className={`w-24 h-24 ${isOnline ? 'animate-pulse' : 'animate-bounce'}`}>
                {isOnline ? (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        className="w-full h-full text-green-400"
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
                        className="w-full h-full text-gray-400"
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
            <h1 className="mt-6 text-4xl sm:text-5xl font-extrabold">
                {isOnline ? "You're back online! 🎉" : "You're offline 📡"}
            </h1>

            {/* Description */}
            <p className="mt-4 text-base sm:text-lg">
                {isOnline ? (
                    <>Your <strong>internet connection</strong> has been restored</>
                ) : (
                    <>Looks like you've lost your <strong>internet connection</strong></>
                )}
            </p>

            <p className="mt-2 text-sm italic text-gray-400">
                "Sometimes you need to disconnect to reconnect." — Anonymous
            </p>

            {/* Connection Indicator */}
            <div
                className={`mt-6 px-4 py-2 rounded-full font-medium inline-block ${isOnline
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                    }`}
            >
                {isOnline ? '✓ Connected' : '✗ No connection'}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 mt-8 w-full max-w-sm"> {/* Added w-full max-w-sm for better button sizing */}
                <button
                    onClick={handleRetry}
                    // Reduced padding (p-2/py-2/px-4) and added w-full for mobile
                    className="flex-1 w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all duration-200 text-base"
                >
                    🔄 Retry connection
                </button>
                <button
                    onClick={handleGoBack}
                    // Reduced padding (p-2/py-2/px-4) and added w-full for mobile
                    className="flex-1 w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-100 font-semibold rounded-xl border border-gray-600 transition-all duration-200 text-base"
                >
                    ❌ Go back
                </button>
            </div>

            {/* Helpful Tips */}
            <ul className="mt-12 list-disc text-left max-w-xs pl-5 space-y-2">
                <li>Check your WiFi or mobile data</li>
                <li>Try airplane mode on/off</li>
                <li>Some features may be cached and still work</li>
            </ul>
        </div>
    );
}