import { test, expect } from '@playwright/test';
import LoginPage from '../page-objects/LoginPage';
import dataSet from "../Data/usersTestData.json" with { type: "json" };

test.describe('Login Functionality', () => {
    let login: LoginPage;
    const firstUser = dataSet[0];

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

    test('@Login @Negative Missing credentials', async () => {
        await login.loginButton.click();
        expect(login.emailInputError).toContainText('Please enter your email');
        expect(login.passwordInputError).toContainText('Please enter a password');
        await login.emailInput.fill(firstUser.username);
        await login.loginButton.click();
        expect(login.passwordInputError).toContainText('Please enter a password');
        await login.emailInput.fill('');
        await login.passwordInput.fill(firstUser.password);
        await login.loginButton.click();
        expect(login.emailInputError).toContainText('Please enter your email');
    });

    test('@Login @Negative Invalid format and credentials', async () => {
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

        await login.emailInput.fill(firstUser.username);
        await login.passwordInput.fill('wrongPassword123');
        await login.loginButton.click();
        await expect(login.generalError).toContainText('Wrong email or password');
    });

    test('@Login @EdgeCase Offline mode', async ({ context }) => {
        await context.setOffline(true);
        await login.emailInput.fill(firstUser.username);
        await login.passwordInput.fill(firstUser.password);
        await login.loginButton.click();
        await expect(login.generalError).toContainText('Unable to connect to the server.');
    });
});