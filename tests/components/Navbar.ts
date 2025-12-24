import { Locator, Page } from "@playwright/test";


export default class Navbar {

    page: Page;
    links: Locator;
    locationsLink: Locator;
    aboutLink: Locator;
    contactLink: Locator;
    logOutLink: Locator;

    constructor(page: Page) {
        this.page = page;
        this.links = page.locator('.nav-links');
        this.locationsLink = page.locator('a:has-text("Locations")');
        this.aboutLink = page.locator('a:has-text("About")');
        this.contactLink = page.locator('a:has-text("Contact")');
        this.logOutLink = page.locator('a:has-text("Log Out")');
    }

    async logout(): Promise<void> {
        await Promise.all([
            this.page.waitForURL('**/login', { timeout: 10000 }),
            this.logOutLink.click()
        ]);

        // Wait for socket cleanup
        await this.page.waitForTimeout(500);
    }
}
