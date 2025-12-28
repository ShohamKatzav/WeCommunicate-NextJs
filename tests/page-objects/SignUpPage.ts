import { Locator, Page } from "@playwright/test";

export default class SignUpPage {

    page: Page;
    signUpHeader: Locator;
    emailInput: Locator;
    sendCodeButton: Locator;
    accountAlreadyExistDiv: Locator;


    constructor(page: Page) {
        this.page = page;
        this.signUpHeader = page.locator('h1:has-text("Create Your Account on WeCommunicate")');
        this.emailInput = page.locator('#email');
        this.sendCodeButton = page.getByRole('button', { name: 'Send Code' });
        this.accountAlreadyExistDiv = page.getByText('An account with this email address already exists.');
    }
}