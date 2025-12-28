import { Locator, Page } from "@playwright/test";

export default class ForgotPasswordPage {

    page: Page;
    forgotPasswordtHeader: Locator;
    emailInput: Locator;
    sendCodeButton: Locator;
    verifyOTPHeader: Locator;
    OTPInput: Locator;
    verifyCodeButton: Locator;
    invalidOTPDiv: Locator;
    OTPVerifiedConfirmation: Locator;
    OTPSentDiv: Locator;
    emailInputError: Locator;

    constructor(page: Page) {
        this.page = page;
        this.forgotPasswordtHeader = page.locator('h1:has-text("Reset Your Password")');
        this.emailInput = page.locator('#email');
        this.sendCodeButton = page.getByRole('button', { name: 'Send Code' });
        this.verifyOTPHeader = page.locator('h1:has-text("Verify OTP")');
        this.OTPInput = page.locator('#otp');
        this.verifyCodeButton = page.getByRole('button', { name: 'Verify Code' });
        this.invalidOTPDiv = page.getByText('Invalid OTP');
        this.OTPVerifiedConfirmation = page.locator('text=OTP verified successfully!');
        this.OTPSentDiv = page.getByText('If an account with this email exists');
        this.emailInputError = page.locator('#email-error');
    }
}