import { Page } from "@playwright/test";
import LoginPage from "./LoginPage";
import ChatPage from "./ChatPage";


export default class POManager {

    page: Page;
    loginPage: LoginPage;
    chatPage: ChatPage;


    constructor(page: Page) {
        this.page = page;
        this.loginPage = new LoginPage(page);
        this.chatPage = new ChatPage(page);
    }

    getLoginPage(): LoginPage {
        return this.loginPage;
    }

    getChatPage(): ChatPage {
        return this.chatPage;
    }


}