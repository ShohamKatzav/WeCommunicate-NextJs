import { Locator, Page } from "@playwright/test";

export default class LocationsPage {

    page: Page;
    locationsHeader: Locator;

    constructor(page: Page) {
        this.page = page;
        this.locationsHeader = page.locator('h1:has-text("Friends\' locations")');
    }
}