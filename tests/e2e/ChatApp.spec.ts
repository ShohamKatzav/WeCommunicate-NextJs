import { test, expect } from '@playwright/test';
import POManager from '../page-objects/POManager';

test.describe('Chat Functionality', () => {
    let pOManager: POManager;

    test('Logout', async ({ page }) => {
        pOManager = new POManager(page);
        await pOManager.getLoginPage().navigateToLoginPage();
        await pOManager.getLoginPage().logout();
        await expect(page.locator('text=Login to WeCommunicate')).toBeVisible();
    });

});