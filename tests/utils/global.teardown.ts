import { request as pfRequest } from '@playwright/test';
import dataSet from "../Data/usersTestData.json" with { type: "json" };
import config from '../playwright.config';
import LoginData from '../types/LoginData';

export default async function globalTeardown() {

    const baseURL = config.use?.baseURL || 'https://localhost:3000';

    const context = await pfRequest.newContext({
        baseURL: baseURL,
        ignoreHTTPSErrors: true
    });
    try {
        const userEmails = dataSet.map((user: LoginData) => user.username);
        const response = await context.post('/api/internal/cleanup-test-user', {
            data: {
                emails: userEmails,
                bypassSecret: process.env.TEST_BYPASS_KEY
            }
        });
        if (!response.ok()) {
            console.error(`Cleanup failed: ${response.status()}`);
        } else {
            const res = await response.json();
            console.log(res.message);
        }

    } catch (error) {
        console.error('Global cleanup failed:', error);
    } finally {
        await context.dispose();
    }
}