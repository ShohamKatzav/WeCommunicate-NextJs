import { Browser, Locator, Page } from "@playwright/test";
import POManager from "./POManager";

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
    loginHeader: Locator;
    forgotPasswordLink: Locator;
    signUpLink: Locator;

    constructor(page: Page) {
        this.page = page;
        this.emailInput = page.locator('#email');
        this.passwordInput = page.locator('#password');
        this.emailInputError = page.locator('#email-error');
        this.passwordInputError = page.locator('#password-error');
        this.loginButton = page.getByRole('button', { name: 'Log in' });
        this.generalError = page.locator('div.border-red-200');
        this.loginHeader = page.locator('h1:has-text("Login to WeCommunicate")');
        this.forgotPasswordLink = page.getByRole('link', { name: 'Forgot password?' });
        this.signUpLink = page.getByRole('link', { name: 'Sign up!' });
    }

    async navigateToLoginPage(): Promise<void> {
        await this.page?.goto("/login");
    }

    async loginByData(data: LoginData): Promise<void> {
        await this.emailInput?.fill(data.username);
        await this.passwordInput?.fill(data.password);
        await this.loginButton?.click();
        await this.page.waitForURL('**/chat');
    }

    async getGreeting(shortUsername: string): Promise<Locator> {
        return this.page.locator(`text=Welcome ${shortUsername}`)
    }

    async loginAnotherUser(browser: Browser, loginData: LoginData): Promise<POManager> {
        const context = await browser.newContext();
        await context.clearCookies();
        const newPage = await context.newPage();
        const pOManager = new POManager(newPage);
        await pOManager.getLoginPage().navigateToLoginPage();
        await pOManager.getLoginPage().loginByData(loginData);
        return pOManager;
    }
}