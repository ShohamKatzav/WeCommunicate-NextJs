import { APIRequestContext } from '@playwright/test';

// Backed by app/api/internal/push-subscriptions/route.ts.

export interface PushRegistration {
    email: string;
    expiresAt: string;
}

export async function getPushRegistrations(request: APIRequestContext, endpoint: string): Promise<PushRegistration[]> {
    const response = await request.post('/api/internal/push-subscriptions', {
        data: { endpoint, bypassSecret: process.env.TEST_BYPASS_KEY },
    });
    if (!response.ok()) {
        throw new Error(`Push subscription lookup failed: ${response.status()}`);
    }
    return (await response.json()).subscriptions;
}

export async function removePushEndpoint(request: APIRequestContext, endpoint: string): Promise<void> {
    const response = await request.delete('/api/internal/push-subscriptions', {
        data: { endpoint, bypassSecret: process.env.TEST_BYPASS_KEY },
    });
    if (!response.ok()) {
        console.error(`Push subscription cleanup failed: ${response.status()}`);
    }
}
