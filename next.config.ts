import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    experimental: {
        globalNotFound: true,
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'kvhqatb9r0bjfpjq.public.blob.vercel-storage.com',
                pathname: '/**',
            },
        ],
    }
};

export default nextConfig;