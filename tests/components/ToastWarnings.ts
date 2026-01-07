import { Locator, Page } from "@playwright/test";


export default class ToastWarnings {

    page: Page;
    messageSendingOfflineWarning: Locator;
    messageDeletingOfflineWarning: Locator;
    messageCleaningHistoryOfflineWarning: Locator;
    conversationDeletingOfflineWarning: Locator;

    constructor(page: Page) {
        this.page = page;
        this.messageSendingOfflineWarning = page.getByText('I’ll send this message when you’re back online').first();
        this.messageDeletingOfflineWarning = page.getByText('The message will be deleted when the connection is restored').first();
        this.messageCleaningHistoryOfflineWarning = page.getByText('I’ll clear your chat history when you’re back online').first();
        this.conversationDeletingOfflineWarning = page.getByText('I’ll delete this conversation once the connection is restored').first();
    }

}