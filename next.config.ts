import type { NextConfig } from "next";

const CSP_DIRECTIVES = [
    "default-src 'self'",
    // Allows scripts from 'self', Google Maps (and 'unsafe-inline' for inline helper scripts)
    "script-src 'self' https://maps.googleapis.com https://maps.gstatic.com 'unsafe-inline'",

    // Allows styles from 'self', Google Fonts stylesheets ('unsafe-inline' for Next.js internal/libraries)
    "style-src 'self' 'unsafe-inline' https://maps.googleapis.com https://fonts.googleapis.com",

    // Allows images from 'self', data URIs, Google Maps assets, and Vercel storage
    "img-src 'self' data: https://maps.googleapis.com https://maps.gstatic.com https://kvhqatb9r0bjfpjq.public.blob.vercel-storage.com",

    // ✅ CRITICAL FIX: ADDED https://fonts.gstatic.com to connect-src for Service Worker fetch calls.
    "connect-src 'self' https://maps.googleapis.com https://maps.gstatic.com https://fonts.googleapis.com https://fonts.gstatic.com https://your-api.vercel.app https://kvhqatb9r0bjfpjq.public.blob.vercel-storage.com http://localhost:3000 ws://localhost:3000 wss://localhost:3000",

    // Allows font files from 'self' and Google Fonts static servers
    "font-src 'self' https://fonts.gstatic.com",
];

const nextConfig: NextConfig = {
    experimental: {
        globalNotFound: true,
    },
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "kvhqatb9r0bjfpjq.public.blob.vercel-storage.com",
                pathname: "/**",
            },
        ],
    },
    async headers() {
        // CSP for all general pages
        const cspHeader = {
            key: "Content-Security-Policy",
            value: CSP_DIRECTIVES.join("; "),
        };

        return [
            {
                source: "/(.*)",
                headers: [
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "X-Frame-Options", value: "DENY" },
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                    cspHeader,
                ],
            },
            {
                source: "/sw.js",
                headers: [
                    { key: "Content-Type", value: "application/javascript; charset=utf-8" },
                    { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
                ],
            },
        ];
    },
};

export default nextConfig;