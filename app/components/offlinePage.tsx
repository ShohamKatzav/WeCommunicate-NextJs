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
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-slate-900 text-gray-50 flex flex-col items-center justify-center text-center px-6">
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

            {/* Status Text */}
            <h1 className="mt-6 text-5xl font-extrabold">
                {isOnline ? "You're back online! 🎉" : "You're offline 📡"}
            </h1>

            {/* Description */}
            <p className="mt-4 text-lg">
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
            <div className="flex gap-3 mt-8">
                <button
                    onClick={handleRetry}
                    className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-2xl transition-all duration-200"
                >
                    🔄 Retry connection
                </button>
                <button
                    onClick={handleGoBack}
                    className="inline-flex items-center gap-2 px-5 py-3 bg-gray-700 hover:bg-gray-600 text-gray-100 font-semibold rounded-2xl border border-gray-600 transition-all duration-200"
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