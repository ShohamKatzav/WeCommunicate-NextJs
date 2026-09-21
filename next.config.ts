import type { NextConfig } from "next";

// React's development build needs eval() for debugging features such as
// reconstructing a callstack from another environment, and refuses with a
// console error without it. Production React never calls eval(), so this stays
// out of the deployed policy - allowing it there would hand an injected script
// the easiest possible way to run arbitrary code.
const DEV_SCRIPT_SOURCES = process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'";

const CSP_DIRECTIVES = [
    "default-src 'self'",
    // Scripts: Your app logic, Google Maps libraries
    `script-src 'self' https://maps.googleapis.com https://maps.gstatic.com 'unsafe-inline'${DEV_SCRIPT_SOURCES}`,

    // Styles: Your CSS, Google Fonts stylesheets
    "style-src 'self' 'unsafe-inline' https://maps.googleapis.com https://fonts.googleapis.com",

    // Images: Map tiles, Vercel Blob images
    "img-src 'self' data: https://maps.googleapis.com https://maps.gstatic.com https://kvhqatb9r0bjfpjq.public.blob.vercel-storage.com",

    // Media: Vercel Blob audio/video
    "media-src 'self' https://kvhqatb9r0bjfpjq.public.blob.vercel-storage.com",

    // Documents: Vercel Blob PDF/Word/Excel loaded via <object>/<embed>/<iframe>
    "object-src 'self' https://kvhqatb9r0bjfpjq.public.blob.vercel-storage.com",

    // Connections: HMR, Service Worker fetches, Vercel Blob API Handshake
    "connect-src 'self' https://maps.googleapis.com https://maps.gstatic.com https://fonts.googleapis.com https://fonts.gstatic.com https://vercel.com https://kvhqatb9r0bjfpjq.public.blob.vercel-storage.com https://localhost:3000 ws://localhost:3000 wss://localhost:3000",

    // Fonts: Google Fonts static files
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
                source: "/service-worker.js",
                headers: [
                    { key: "Content-Type", value: "application/javascript; charset=utf-8" },
                    { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
                ],
            },
            {
                source: "/indexdb-queue.js",
                headers: [
                    { key: "Content-Type", value: "application/javascript; charset=utf-8" },
                    { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
                ],
            },
            {
                // Body and Content-Type are chosen per User-Agent in
                // app/api/web-manifest/route.ts (rewritten from /manifest.json).
                // Cache-Control stays here so a CDN in front of Render cannot
                // pin the Chrome POST share_target payload onto a Samsung
                // Internet request.
                source: "/manifest.json",
                headers: [
                    { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
                    { key: "Vary", value: "User-Agent" },
                ],
            },
        ];
    },
    async rewrites() {
        // public/manifest.json was a static file, so it could not vary by
        // User-Agent. Samsung Internet's WebAPK builder fails on POST
        // share_target ("Failed to download"); Chrome needs POST for file
        // shares. The route at /api/web-manifest picks which body to send.
        return [
            { source: "/manifest.json", destination: "/api/web-manifest" },
        ];
    },
};

export default nextConfig;
