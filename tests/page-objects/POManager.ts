import { Page } from "@playwright/test";
import LoginPage from "./LoginPage";
import ChatPage from "./ChatPage";
import AboutPage from "./AboutPage";
import ContactPage from "./ContactPage";
import LocationsPage from "./LocationsPage";


export default class POManager {

    page: Page;
    private loginPage: LoginPage;
    private chatPage: ChatPage;
    private aboutPage: AboutPage;
    private contactPage: ContactPage;
    private locationsPage: LocationsPage;


    constructor(page: Page) {
        this.page = page;
        this.loginPage = new LoginPage(page);
        this.chatPage = new ChatPage(page);
        this.aboutPage = new AboutPage(page);
        this.contactPage = new ContactPage(page);
        this.locationsPage = new LocationsPage(page);
    }

    getLoginPage() {
        if (!this.loginPage) {
            this.loginPage = new LoginPage(this.page);
        }
        return this.loginPage;
    }

    getChatPage() {
        if (!this.chatPage) {
            this.chatPage = new ChatPage(this.page);
        }
        return this.chatPage;
    }

    getAboutPage() {
        if (!this.aboutPage) {
            this.aboutPage = new AboutPage(this.page);
        }
        return this.aboutPage;
    }

    getContactPage() {
        if (!this.contactPage) {
            this.contactPage = new ContactPage(this.page);
        }
        return this.contactPage;
    }

    getLocationsPage() {
        if (!this.locationsPage) {
            this.locationsPage = new LocationsPage(this.page);
        }
        return this.locationsPage;
    }
}