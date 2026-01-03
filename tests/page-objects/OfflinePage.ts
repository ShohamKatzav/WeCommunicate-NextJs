import { BrowserContext, Locator, Page } from "@playwright/test";

export default class OfflinePage {

    page: Page;
    offlineHeader: Locator;


    constructor(page: Page) {
        this.page = page;
        this.offlineHeader = page.getByText("You're offline");
    }
}