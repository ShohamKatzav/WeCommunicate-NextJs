import { test } from '@playwright/test';
import { customTest } from '../fixtures/test-base';

test.describe('Login Functionality', () => {

    customTest('setup', async ({ page, loginData, authPage }) => {
        await authPage.getLoginPage().navigateToLoginPage();
        await authPage.getLoginPage().loginByData(loginData);
        await page.context().storageState({ path: 'tests/state.json' });
    });

});