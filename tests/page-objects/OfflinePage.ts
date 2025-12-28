import { Locator, Page } from "@playwright/test";

export default class OfflinePage {

    page: Page;
    offlineHeader: Locator;


    constructor(page: Page) {
        this.page = page;
        this.offlineHeader = page.getByText("You're offline");
    }

    async waitForServiceWorkerSign(): Promise<void> {
        await this.page.evaluate(async () => {
            await navigator.serviceWorker.ready;
            // Ensure the service worker is actually controlling the page
            if (!navigator.serviceWorker.controller) {
                window.location.reload();
            }
        })
    }
}