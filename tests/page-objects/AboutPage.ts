import { Locator, Page } from "@playwright/test";

export default class AboutPage {

    page: Page;
    aboutHeader: Locator;

    constructor(page: Page) {
        this.page = page;
        this.aboutHeader = page.locator('h1:has-text("About")');
    }
}