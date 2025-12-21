import { Locator, Page } from "@playwright/test";


export default class General {

    page: Page;
    links: Locator;
    logOutLink: Locator;

    constructor(page: Page) {
        this.page = page;
        this.links = page.locator('.nav-links');
        this.logOutLink = page.locator('a:has-text("Log Out")');
    }

    async logout() {
        await Promise.all([
            this.page?.waitForURL('**/login'),
            this.logOutLink?.click()
        ]);

    }
}
