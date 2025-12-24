import { expect } from '@playwright/test';
import { customTest } from '../fixtures/test-base';

customTest.describe.configure({ mode: 'serial' });

customTest.describe('Navigation Functionality', () => {

    customTest('Navigation and Logout Flow', async ({ loginData, authPage }) => {
        await authPage.getLoginPage().navigateToLoginPage();
        const shortUsername = loginData.username.split('@')[0];
        await expect(await authPage.getLoginPage().getGreeting(shortUsername)).toBeVisible();
        await authPage.getChatPage().navigateToLocationsPage();
        await expect(authPage.getLocationsPage().locationsHeader).toBeVisible();
        await authPage.getChatPage().navbar.aboutLink.click();
        await expect(authPage.getAboutPage().aboutHeader).toBeVisible();
        await authPage.getChatPage().navbar.contactLink.click();
        await expect(authPage.getContactPage().contactHeader).toBeVisible();
        await authPage.getChatPage().navbar.logout();
        await expect(authPage.getLoginPage().loginHeader).toBeVisible();
    });
});