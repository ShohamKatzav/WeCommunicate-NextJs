import { request as pfRequest } from '@playwright/test';
import dataSet from "../Data/usersTestData.json" with { type: "json" };
import config from '../playwright.config';

export default async function globalTeardown() {

    const baseURL = config.use?.baseURL || 'https://localhost:3000';

    const context = await pfRequest.newContext({
        baseURL: baseURL,
        ignoreHTTPSErrors: true
    });
    try {
        for (const data of dataSet) {
            const response = await context.post('/api/internal/cleanup-test-user', {
                data: {
                    email: data.username,
                    bypassSecret: process.env.TEST_BYPASS_KEY
                }
            });
            if (!response.ok()) {
                console.error(`Cleanup failed for ${data.username}: ${response.status()}`);
            } else {
                console.log(`Cleaned up user: ${data.username}`);
            }
        }
    } catch (error) {
        console.error('Global cleanup failed:', error);
    } finally {
        await context.dispose();
    }
}