import { test } from '@playwright/test';
import { customTest } from '../fixtures/test-base';

const users = [
    { index: 1, username: 'shoham@gmail.com', password: '12345678' },
    { index: 2, username: 'skgladiator3@gmail.com', password: '12345678' },
    { index: 3, username: 'skgladiator4@gmail.com', password: '12345678' },
    { index: 4, username: 'skgladiator5@gmail.com', password: '12345678' },
];

test.describe('Login Functionality', () => {

    for (const user of users) {
        customTest(`setup - ${user.username}`, async ({ page, authPage }) => {
            await authPage.getLoginPage().navigateToLoginPage();
            await authPage.getLoginPage().loginByData({ username: user.username, password: user.password });
            // The suite asserts English copy, but login copies the account's
            // saved language onto the device - an account left in Hebrew (say,
            // by someone trying the app with it) turned every later test
            // Hebrew. Picking English in the footer saves it to the account and
            // the cookie both, so later logins in the tests stay English too.
            await page.goto('/contact');
            await page.locator('footer select').selectOption('en');
            await page.waitForFunction(() => document.documentElement.lang === 'en');
            await page.context().storageState({ path: `tests/state${user.index}.json` });
        });
    }

});