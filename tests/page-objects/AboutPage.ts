import { Locator, Page } from "@playwright/test";
import Navbar from "../components/Navbar";

export default class AboutPage {

    page: Page;
    navbar: Navbar;
    aboutHeader: Locator;

    constructor(page: Page) {
        this.page = page;
        this.navbar = new Navbar(page);
        this.aboutHeader = page.locator('h1:has-text("About")');
    }

    async navigateToAboutPage(): Promise<void> {
        await Promise.all([
            this.page?.waitForURL('**/about'),
            this.navbar.aboutLink?.click()
        ]);
    }
}