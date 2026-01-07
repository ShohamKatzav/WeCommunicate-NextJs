import { Locator, Page } from "@playwright/test";


export default class ConversationForm {

    page: Page;
    participantLabel: Locator;
    startChattingButton: Locator;
    createGroupButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.participantLabel = page.locator("label[for^='participant']");
        this.startChattingButton = page.getByRole('button', { name: 'Start chatting' });
        this.createGroupButton = page.locator("//button[contains(text(),'Create Group')]");
    }

}
