import { test, expect } from '@playwright/test';
import LoginPage from '../page-objects/LoginPage';
import { customTest } from '../fixtures/test-base';
import dataSet from "../Data/usersTestData.json" with { type: "json" };

test.use({ storageState: { cookies: [], origins: [] } });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test.describe('Login Functionality', () => {
    let login: LoginPage;

    test.beforeEach(async ({ page }) => {
        login = new LoginPage(page);
        await login.navigateToLoginPage();
    });

    for (const data of dataSet) {
        test(`@Login @HappyPath Successful login for ${data.username}`, async ({ page }) => {
            await login.loginByData(data);
            const shortUsername = data.username.split('@')[0];
            await expect(page.locator(`text=Welcome ${shortUsername}`)).toBeVisible();
        });
    }

    customTest('@Login @Negative Missing credentials', async ({ loginData }) => {
        await login.loginButton.click();
        expect(login.emailInputError).toContainText('Please enter your email');
        expect(login.passwordInputError).toContainText('Please enter a password');
        await login.emailInput.fill(loginData.username);
        await login.loginButton.click();
        expect(login.passwordInputError).toContainText('Please enter a password');
        await login.emailInput.fill('');
        await login.passwordInput.fill(loginData.password);
        await login.loginButton.click();
        expect(login.emailInputError).toContainText('Please enter your email');
    });

    customTest('@Login @Negative Invalid format and credentials', async ({ loginData }) => {
        await login.emailInput.fill('shoham');
        await login.loginButton.click();
        let validationError = await login.getEmailValidationError();
        expect(validationError).toContain("Please include an '@' in the email address");

        await login.emailInput.fill('shoham@');
        await login.loginButton.click();
        validationError = await login.getEmailValidationError();
        expect(validationError).toContain("Please enter a part following '@'");

        await login.emailInput.fill('shoham@g');
        await login.loginButton.click();
        await expect(login.emailInputError).toContainText('Please enter a valid email');

        await login.emailInput.fill(loginData.username);
        await login.passwordInput.fill('wrongPassword123');
        await login.loginButton.click();
        await expect(login.generalError).toContainText('Wrong email or password');
    });

    customTest('@Login @EdgeCase Offline mode', async ({ context, loginData }) => {
        await context.setOffline(true);
        await login.emailInput.fill(loginData.username);
        await login.passwordInput.fill(loginData.password);
        await login.loginButton.click();
        await expect(login.generalError).toContainText('Unable to connect to the server.');
    });
});