import { z } from 'zod';

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']),
    NEXT_PUBLIC_BASE_ADDRESS: z.url(),
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string(),
    NEXT_PUBLIC_MESSAGES_PER_PAGE: z.coerce.number().min(5).default(5),
    NEXT_OFFLINE_CACHE_NAME: z.string().default("wecommunicate-v5"),
    JWT_SECRET_KEY: z.string().min(32),
    DB_URI: z.string(),
    BLOB_READ_WRITE_TOKEN: z.string(),
    VERCEL_BLOB_CALLBACK_URL: z.url(),
    UPSTASH_REDIS_REST_URL: z.url(),
    UPSTASH_REDIS_REST_TOKEN: z.string(),
    BREVO_API_KEY: z.string(),
    SMTP_USER: z.email(),
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string(),
    VAPID_PRIVATE_KEY: z.string(),
    E2E_TEST: z.string().optional().default('false'),
    TEST_BYPASS_KEY: z.string().optional(),

});

export const env = envSchema.parse(process.env);