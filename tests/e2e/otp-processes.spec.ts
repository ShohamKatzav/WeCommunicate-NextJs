import { expect } from '@playwright/test';
import { customTest } from '../fixtures/test-base';

customTest.use({
    storageState: { cookies: [], origins: [] },
    extraHTTPHeaders: {
        'x-bypass-ratelimit': process.env.TEST_BYPASS_KEY || '',
    },
});

customTest.describe('OTP processes - Forgot Password Functionality', () => {

    customTest('Forgot My Password - Email Validations', async ({ authPage, loginData }) => {
        await authPage.getLoginPage().navigateToLoginPage();
        await authPage.getLoginPage().forgotPasswordLink.click();
        await expect(authPage.getForgotPasswordPage().forgotPasswordtHeader).toBeVisible();

        // Wait for network to settle so React finishes rendering before email validation
        await authPage.getForgotPasswordPage().page.waitForLoadState('networkidle');
        await authPage.getForgotPasswordPage().sendCodeButton.click();
        await expect(authPage.getForgotPasswordPage().sendCodeButton).toBeEnabled();
        await expect(authPage.getForgotPasswordPage().emailInputError).toContainText('Please enter your email');

        await authPage.getForgotPasswordPage().emailInput.click();
        await authPage.getForgotPasswordPage().emailInput.fill('shoham');
        await expect(authPage.getForgotPasswordPage().emailInput).toHaveValue('shoham');
        await authPage.getForgotPasswordPage().sendCodeButton.click();
        let validationError = await authPage.getEmailValidationError(authPage.getForgotPasswordPage().emailInput);
        expect(validationError).toContain("Please include an '@' in the email address");

        await authPage.getForgotPasswordPage().emailInput.click();
        await authPage.getForgotPasswordPage().emailInput.fill('shoham@');
        await expect(authPage.getForgotPasswordPage().emailInput).toHaveValue('shoham@');
        await authPage.getForgotPasswordPage().sendCodeButton.click();
        validationError = await authPage.getEmailValidationError(authPage.getForgotPasswordPage().emailInput);
        expect(validationError).toContain("Please enter a part following '@'");

        await authPage.getForgotPasswordPage().page.waitForLoadState('networkidle');
        await authPage.getForgotPasswordPage().emailInput.fill('shoham@g');
        await authPage.getForgotPasswordPage().sendCodeButton.click();
        await expect(authPage.getForgotPasswordPage().sendCodeButton).toBeEnabled();
        await expect(authPage.getForgotPasswordPage().emailInputError).toContainText('Please enter a valid email');

        await authPage.getForgotPasswordPage().emailInput.click();
        await authPage.getForgotPasswordPage().emailInput.fill(loginData.username);
        await expect(authPage.getForgotPasswordPage().emailInput).toHaveValue(loginData.username);
        await authPage.getForgotPasswordPage().sendCodeButton.click();
        await expect(authPage.getForgotPasswordPage().OTPSentDiv).toBeVisible();

    });

    customTest('Forgot My Password - Fake account - Mimic code sending', async ({ authPage }) => {
        const fakeUsername = 'exampleFakeUser787@vmail.com';
        await authPage.getLoginPage().navigateToLoginPage();
        await authPage.getLoginPage().forgotPasswordLink.click();
        await expect(authPage.getForgotPasswordPage().forgotPasswordtHeader).toBeVisible();

        await authPage.getForgotPasswordPage().page.waitForLoadState('networkidle');
        await authPage.getForgotPasswordPage().emailInput.fill(fakeUsername);
        await authPage.getForgotPasswordPage().sendCodeButton.click();
        await expect(authPage.getForgotPasswordPage().verifyCodeButton).toBeEnabled();
        await expect(authPage.getForgotPasswordPage().OTPSentDiv).toBeVisible();
    });

    customTest('Forgot My Password - Wrong Code', async ({ authPage, loginData }) => {
        await authPage.getLoginPage().navigateToLoginPage();
        await authPage.getLoginPage().forgotPasswordLink.click();
        await expect(authPage.getForgotPasswordPage().forgotPasswordtHeader).toBeVisible();

        await authPage.getForgotPasswordPage().page.waitForLoadState('networkidle');
        await authPage.getForgotPasswordPage().emailInput.fill(loginData.username);
        await authPage.getForgotPasswordPage().sendCodeButton.click();
        await expect(authPage.getForgotPasswordPage().verifyCodeButton).toBeEnabled();
        await expect(authPage.getForgotPasswordPage().verifyOTPHeader).toBeVisible();
        await authPage.getForgotPasswordPage().OTPInput.fill('000000');
        await authPage.getForgotPasswordPage().verifyCodeButton.click();
        await expect(authPage.getForgotPasswordPage().invalidOTPDiv).toBeVisible();

    });

    customTest('Forgot My Password', async ({ context, authPage, loginData, baseURL }) => {
        const domain = new URL(baseURL || 'https://localhost:3000').hostname;
        await context.addCookies([
            {
                name: 'e2e',
                value: process.env.TEST_BYPASS_KEY || 'development_secret',
                domain: domain === 'localhost' ? 'localhost' : domain,
                path: '/',
                httpOnly: true,
            },
        ]);
        await authPage.getLoginPage().navigateToLoginPage();
        await authPage.getLoginPage().forgotPasswordLink.click();
        await expect(authPage.getForgotPasswordPage().forgotPasswordtHeader).toBeVisible();

        await authPage.getForgotPasswordPage().page.waitForLoadState('networkidle');
        await authPage.getForgotPasswordPage().emailInput.fill(loginData.username);
        await authPage.getForgotPasswordPage().sendCodeButton.click();
        await expect(authPage.getForgotPasswordPage().verifyCodeButton).toBeEnabled();
        await expect(authPage.getForgotPasswordPage().verifyOTPHeader).toBeVisible();
        await authPage.getForgotPasswordPage().OTPInput.fill('000000');
        await authPage.getForgotPasswordPage().verifyCodeButton.click();
        await expect(authPage.getForgotPasswordPage().OTPVerifiedConfirmation).toBeVisible();

    });
});

customTest.describe('OTP processes - Sign up Functionality', () => {

    customTest('Signing up using existing email flow', async ({ authPage, loginData }) => {
        await authPage.getLoginPage().navigateToLoginPage();
        await authPage.getLoginPage().signUpLink.click();
        await authPage.getSignUpPage().page.waitForLoadState('networkidle');
        await authPage.getSignUpPage().emailInput.fill(loginData.username);
        await authPage.getSignUpPage().sendCodeButton.click();
        await expect(authPage.getSignUpPage().sendCodeButton).toBeEnabled();
        await expect(authPage.getSignUpPage().accountAlreadyExistDiv).toBeVisible();
    });
});
