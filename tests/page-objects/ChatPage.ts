import { Locator, Page } from "@playwright/test";


export default class ChatPage {

    page: Page;

    constructor(page: Page) {
        this.page = page;
    }

}