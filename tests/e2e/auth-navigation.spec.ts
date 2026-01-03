import { expect } from '@playwright/test';
import { customTest } from '../fixtures/test-base';

const FAKE_TOKEN_VALUE = '%7B%22email%22%3A%22Shoham%40gmail.com%22%2C%22token%22%3A%22eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaXQiOiI2NTdlODI0ZGUzZDBhNWU1NjMzMDY5ZjUiLCJlbWFpbCI6InNob2hhbUBnbWFpbC5jb20iLCJzaWduSW5UaW1lIjoxNzY3MzgxNTA1MzU5LCJpYXQiOjE3NjczODE1MDV9.fLMVtoKg82J6FW-4RJqqVNUnJrf8RqJbRU8bHSDc2c8%22%7D';

customTest.use({ storageState: { cookies: [], origins: [] } });
customTest.describe('Navigation Functionality', () => {

    customTest.describe('Navigation tests reqiered login', () => {
        customTest.use({ storageState: 'tests/state1.json' });

        customTest('Navigation and Logout Flow', async ({ loginData, authPage }) => {
            await authPage.getLoginPage().navigateToLoginPage();
            const shortUsername = loginData.username.split('@')[0];
            await expect(await authPage.getLoginPage().getGreeting(shortUsername)).toBeVisible();
            await authPage.getLocationsPage().navigateToLocationsPage();
            await expect(authPage.getLocationsPage().locationsHeader).toBeVisible();
            await authPage.getAboutPage().navigateToAboutPage();
            await expect(authPage.getAboutPage().aboutHeader).toBeVisible();
            await authPage.getContactPage().navigateToContactPage();
            await expect(authPage.getContactPage().contactHeader).toBeVisible();
            await authPage.getChatPage().navbar.logout();
            await expect(authPage.getLoginPage().loginHeader).toBeVisible();
        });

        customTest('Navigate back from non exist path by back to chat button', async ({ authPage, loginData }) => {
            await authPage.page.goto('/fakepath');
            await expect(authPage.get404Page().header404).toBeVisible();
            await authPage.get404Page().backToChatButton.click();
            const shortUsername = loginData.username.split('@')[0];
            await expect(await authPage.getLoginPage().getGreeting(shortUsername)).toBeVisible();
        });
    });

    customTest('Allow navigation to non secured about path without login', async ({ page }) => {
        await page.goto('/about');
        await expect(page).toHaveURL(/\/about$/);
    });

    customTest('Allow navigation to non secured contact path without login', async ({ page }) => {
        await page.goto('/contact');
        await expect(page).toHaveURL(/\/contact$/);
    });

    customTest('Navigation to secured chat page without login', async ({ page }) => {
        await page.goto('/chat');
        await expect(page).toHaveURL(/\/login$/);
    });

    customTest('Navigation to secured locations page without login', async ({ page }) => {
        await page.goto('/locations');
        await expect(page).toHaveURL(/\/login$/);
    });

    customTest('Navigation to secured chat page with fake token', async ({ browser, baseURL }) => {
        const context = await browser.newContext();
        const domain = new URL(baseURL || 'https://localhost:3000').hostname;
        await context.addCookies([
            {
                name: 'user',
                value: FAKE_TOKEN_VALUE,
                domain: domain === 'localhost' ? 'localhost' : domain,
                path: '/',
                expires: 1767986305.408707,
                httpOnly: true,
                secure: true,
                sameSite: "Lax"
            },
        ]);
        const page = await context.newPage();
        await page.goto('/chat');
        await expect(page).toHaveURL(/\/login$/);
        await context.close();
    });

    customTest('Navigation to non exist path', async ({ authPage }) => {
        await authPage.page.goto('/fakepath');
        await expect(authPage.get404Page().header404).toBeVisible();
    });

    customTest('Navigate back from non exist path by go back button', async ({ authPage }) => {
        await authPage.page.goto('/about');
        await authPage.page.goto('/fakepath');
        await expect(authPage.get404Page().header404).toBeVisible();
        await authPage.get404Page().goBackButton.click();
        await expect(authPage.getAboutPage().aboutHeader).toBeVisible();
    });

});