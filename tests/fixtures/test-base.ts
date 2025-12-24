import { test as baseTest } from '@playwright/test';
import POManager from '../page-objects/POManager';

interface LoginData {
    username: string;
    password: string;
}

export const customTest = baseTest.extend<{
    loginData: LoginData;
    poManager: POManager;
    authPage: POManager;
}>({
    loginData: {
        username: "shoham@gmail.com",
        password: "12345678"
    },

    poManager: async ({ page }, use) => {
        await use(new POManager(page));
    },
    authPage: async ({ poManager, context }, use) => {
        await context.grantPermissions(['geolocation']);
        await use(poManager);
    }
});