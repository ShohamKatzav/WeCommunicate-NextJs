import { Locator, Page } from "@playwright/test";

interface LoginData {
    username: string;
    password: string;
}

export default class LoginPage {

    page: Page;
    emailInput: Locator;
    passwordInput: Locator;
    emailInputError: Locator;
    passwordInputError: Locator;
    loginButton: Locator;
    generalError: Locator;

    constructor(page: Page) {
        this.page = page;
        this.emailInput = page.locator('#email');
        this.passwordInput = page.locator('#password');
        this.emailInputError = page.locator('#email-error');
        this.passwordInputError = page.locator('#password-error');
        this.loginButton = page.getByRole('button', { name: 'Log in' });
        this.generalError = page.locator('div.border-red-200');
    }

    async navigateToLoginPage(): Promise<void> {
        await this.page?.goto("/login");
    }

    async loginByData(data: LoginData): Promise<void> {
        await this.emailInput?.fill(data.username);
        await this.passwordInput?.fill(data.password);
        await Promise.all([
            this.page?.waitForURL('**/chat'),
            this.loginButton?.click()
        ]);
    }

    async getEmailValidationError(): Promise<string> {
        return await this.emailInput?.evaluate((input: HTMLInputElement) => {
            return input.validationMessage;
        });
    }
}