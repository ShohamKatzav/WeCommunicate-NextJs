import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    /* config options here */
    experimental: {
        globalNotFound: true,
    },
    images: {
        remotePatterns: [new URL('https://kvhqatb9r0bjfpjq.public.blob.vercel-storage.com/**')],
    },
};

export default nextConfig;
