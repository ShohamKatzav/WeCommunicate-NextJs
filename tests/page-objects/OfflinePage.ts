import { BrowserContext, Locator, Page } from "@playwright/test";

export default class OfflinePage {

    page: Page;
    offlineHeader: Locator;


    constructor(page: Page) {
        this.page = page;
        this.offlineHeader = page.getByText("You're offline");
    }

    async waitForServiceWorkerReady(context: BrowserContext): Promise<void> {
        const serviceWorkerPromise = context.waitForEvent('serviceworker');
        await serviceWorkerPromise;
        await this.page.evaluate(async () => {
            const registration = await navigator.serviceWorker.ready;
            return registration.active?.scriptURL;
        });
    }

}