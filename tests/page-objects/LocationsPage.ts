import { Locator, Page } from "@playwright/test";
import Navbar from "../components/Navbar";

export default class LocationsPage {

    page: Page;
    navbar: Navbar;
    locationsHeader: Locator;

    constructor(page: Page) {
        this.page = page;
        this.navbar = new Navbar(page);
        this.locationsHeader = page.locator('h1:has-text("Friends\' locations")');
    }

    async navigateToLocationsPage(): Promise<void> {
        await Promise.all([
            this.page?.waitForURL('**/locations'),
            this.navbar.locationsLink?.click()
        ]);
    }
}