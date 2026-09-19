import { env } from '@/app/config/env';
import { headers } from 'next/headers';

// Shared by every server-side rate limiter. Matches the bypass already used
// by socket/rateLimitMiddleware.js, and relies on the same header that
// tests/playwright.config.ts already sends on every request
// (extraHTTPHeaders['x-bypass-ratelimit']). Gated on E2E_TEST so this can
// never do anything outside a test run, even if the secret leaked.
export async function isTestBypass(): Promise<boolean> {
    if (env.E2E_TEST !== 'true' || !env.TEST_BYPASS_KEY) return false;
    const bypassSecret = (await headers()).get('x-bypass-ratelimit');
    return bypassSecret === env.TEST_BYPASS_KEY;
}
