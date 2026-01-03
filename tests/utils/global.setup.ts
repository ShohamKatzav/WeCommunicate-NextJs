import { test } from '@playwright/test';
import { customTest } from '../fixtures/test-base';

const users = [
    { index: 1, username: 'shoham@gmail.com', password: '12345678' },
    { index: 2, username: 'skgladiator3@gmail.com', password: '12345678' },
    { index: 3, username: 'skgladiator4@gmail.com', password: '12345678' },
];

test.describe('Login Functionality', () => {

    for (const user of users) {
        customTest(`setup - ${user.username}`, async ({ page, authPage }) => {
            await authPage.getLoginPage().navigateToLoginPage();
            await authPage.getLoginPage().loginByData({ username: user.username, password: user.password });
            await page.context().storageState({ path: `tests/state${user.index}.json` });
        });
    }

});