import { Locator, Page } from "@playwright/test";

export default class ContactPage {

    page: Page;
    contactHeader: Locator;

    constructor(page: Page) {
        this.page = page;
        this.contactHeader = page.locator('h1:has-text("Get in Touch")');
    }
}