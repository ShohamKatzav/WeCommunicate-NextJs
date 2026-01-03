import { Locator, Page } from "@playwright/test";

export default class Page404 {

    page: Page;
    header404: Locator;
    backToChatButton: Locator;
    goBackButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.header404 = page.locator('h1:has-text("404 — Chat not found")');
        this.backToChatButton = page.getByRole('button', { name: 'Back to chat' });
        this.goBackButton = page.getByRole('button', { name: 'Go back' });
    }
}