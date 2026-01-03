import { Locator, Page } from "@playwright/test";
import Navbar from "../components/Navbar";

export default class ContactPage {

    page: Page;
    navbar: Navbar;
    contactHeader: Locator;

    constructor(page: Page) {
        this.page = page;
        this.navbar = new Navbar(page);
        this.contactHeader = page.locator('h1:has-text("Get in Touch")');
    }

    async navigateToContactPage(): Promise<void> {
        await Promise.all([
            this.page?.waitForURL('**/contact'),
            this.navbar.contactLink?.click()
        ]);
    }
}