import { expect } from '@playwright/test';
import { customTest } from '../fixtures/test-base';

customTest.describe('Offline mode - Edge cases', () => {

    customTest.afterEach(async ({ context }) => {
        await context.setOffline(false);
    });

    customTest('@Offline mode - @Navigate to chat page', async ({ context, authPage }) => {
        await authPage.getLoginPage().navigateToLoginPage();
        await authPage.getChatPage().navbar.aboutLink.click();
        await expect(authPage.getAboutPage().aboutHeader).toBeVisible();
        await authPage.getOfflinePage().waitForServiceWorkerSign();
        await context.setOffline(true);
        await authPage.getChatPage().navbar.chatLink.click();
        await expect(authPage.getOfflinePage().offlineHeader).toBeVisible();

    });

    customTest('@Offline mode - @Navigate to locations page', async ({ context, authPage }) => {
        await authPage.getLoginPage().navigateToLoginPage();
        await authPage.getChatPage().navbar.aboutLink.click();
        await expect(authPage.getAboutPage().aboutHeader).toBeVisible();
        await authPage.getOfflinePage().waitForServiceWorkerSign();
        await context.setOffline(true);
        await authPage.getChatPage().navbar.locationsLink.click();
        await expect(authPage.getOfflinePage().offlineHeader).toBeVisible();

    });
});