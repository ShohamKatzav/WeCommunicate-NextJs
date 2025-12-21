import { test } from '@playwright/test';
import LoginPage from '../page-objects/LoginPage';
import { customTest } from '../fixtures/test-base';

test.describe('Login Functionality', () => {
    let login: LoginPage;

    customTest('setup', async ({ page, loginData }) => {
        login = new LoginPage(page);
        await login.navigateToLoginPage();
        await login.loginByData(loginData);
        await page.context().storageState({ path: 'tests/state.json' });
    });

});