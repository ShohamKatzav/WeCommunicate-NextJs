import { request as pfRequest } from '@playwright/test';
import dataSet from "../Data/usersTestData.json" with { type: "json" };
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../..', '.env.local') });

async function cleanup() {
    console.log('========================================');
    console.log('MANUAL CLEANUP STARTED');
    console.log('========================================');

    const baseURL = process.env.BASE_URL || 'https://localhost:3000';
    console.log('Base URL:', baseURL);

    const context = await pfRequest.newContext({
        baseURL,
        ignoreHTTPSErrors: true
    });

    try {
        for (const data of dataSet) {
            console.log(`Cleaning up user: ${data.username}`);

            const response = await context.post('/api/internal/cleanup-test-user', {
                data: {
                    email: data.username,
                    bypassSecret: process.env.TEST_BYPASS_KEY
                }
            });

            if (!response.ok()) {
                const body = await response.text();
                console.error(`❌ Cleanup failed for ${data.username}: ${response.status()} - ${body}`);
            } else {
                console.log(`✅ Cleaned up user: ${data.username}`);
            }
        }
        console.log('========================================');
        console.log('CLEANUP COMPLETED SUCCESSFULLY');
        console.log('========================================');
    } catch (error) {
        console.error('Cleanup error:', error);
    } finally {
        await context.dispose();
    }
}

cleanup();