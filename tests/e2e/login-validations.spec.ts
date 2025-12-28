import { expect } from '@playwright/test';
import { customTest } from '../fixtures/test-base';
import dataSet from "../Data/usersTestData.json" with { type: "json" };

customTest.use({ storageState: { cookies: [], origins: [] } });

customTest.describe('Login Functionality', () => {

    customTest.beforeEach(async ({ authPage }) => {
        await authPage.getLoginPage().navigateToLoginPage();
    });

    for (const data of dataSet) {
        customTest(`@Login @HappyPath Successful login for ${data.username}`, async ({ authPage }) => {
            await authPage.getLoginPage().loginByData(data);
            const shortUsername = data.username.split('@')[0];
            await expect(await authPage.getLoginPage().getGreeting(shortUsername)).toBeVisible();
        });
    }

    customTest('@Login @Negative Missing credentials', async ({ authPage, loginData }) => {
        await authPage.getLoginPage().loginButton.click();
        expect(authPage.getLoginPage().emailInputError).toContainText('Please enter your email');
        expect(authPage.getLoginPage().passwordInputError).toContainText('Please enter a password');
        await authPage.getLoginPage().emailInput.fill(loginData.username);
        await authPage.getLoginPage().loginButton.click();
        expect(authPage.getLoginPage().passwordInputError).toContainText('Please enter a password');
        await authPage.getLoginPage().emailInput.fill('');
        await authPage.getLoginPage().passwordInput.fill(loginData.password);
        await authPage.getLoginPage().loginButton.click();
        expect(authPage.getLoginPage().emailInputError).toContainText('Please enter your email');
    });

    customTest('@Login @Negative Invalid format and credentials', async ({ authPage, loginData }) => {
        await authPage.getLoginPage().emailInput.fill('shoham');
        await authPage.getLoginPage().loginButton.click();
        let validationError = await authPage.getEmailValidationError(authPage.getLoginPage().emailInput);
        expect(validationError).toContain("Please include an '@' in the email address");

        await authPage.getLoginPage().emailInput.fill('shoham@');
        await authPage.getLoginPage().loginButton.click();
        validationError = await authPage.getEmailValidationError(authPage.getLoginPage().emailInput);
        expect(validationError).toContain("Please enter a part following '@'");

        await authPage.getLoginPage().emailInput.fill('shoham@g');
        await authPage.getLoginPage().loginButton.click();
        await expect(authPage.getLoginPage().emailInputError).toContainText('Please enter a valid email');

        await authPage.getLoginPage().emailInput.fill(loginData.username);
        await authPage.getLoginPage().passwordInput.fill('wrongPassword123');
        await authPage.getLoginPage().loginButton.click();
        await expect(authPage.getLoginPage().generalError).toContainText('Wrong email or password');
    });

    customTest('@Login @Offline mode', async ({ context, authPage, loginData }) => {
        await context.setOffline(true);
        await authPage.getLoginPage().emailInput.fill(loginData.username);
        await authPage.getLoginPage().passwordInput.fill(loginData.password);
        await authPage.getLoginPage().loginButton.click();
        await expect(authPage.getLoginPage().generalError).toContainText('Unable to connect to the server.');
        await context.setOffline(false);
    });
});