import { expect, Locator, Page } from "@playwright/test";
import Navbar from "../components/Navbar";


export default class ChatPage {

    page: Page;
    onlineUsersCount: Locator;
    navbar: Navbar;
    messageInput: Locator;
    sendMessageButton: Locator;
    pendingMessageIndicator: Locator;
    lastMessageSent: Locator;
    lastMessageReceived: Locator;
    dropdownButton: Locator;
    leaveRoomButton: Locator;
    fileInputLabel: Locator;
    fileInput: Locator;

    constructor(page: Page) {
        this.page = page;
        this.navbar = new Navbar(page);
        this.onlineUsersCount = page.locator('div.text-green-600:has-text("Online")');
        this.messageInput = page.getByRole('textbox', { name: 'Message input' });
        this.sendMessageButton = page.getByRole('button', { name: 'Send message' });
        this.pendingMessageIndicator = page.locator('.inline');
        this.lastMessageSent = page.locator('.overflow-y-scroll div.bg-green-500:last-child');
        this.lastMessageReceived = page.locator('.overflow-y-scroll div.bg-gray-500:last-child');
        this.dropdownButton = page.locator('#dropdown-button');
        this.leaveRoomButton = page.locator('button:has-text(" Leave Room")');
        this.fileInputLabel = page.locator('#uploaded-file').locator('..');
        this.fileInput = page.locator('#uploaded-file');
    }

    async navigateToLocationsPage(): Promise<void> {
        await Promise.all([
            this.page?.waitForURL('**/locations'),
            this.navbar.locationsLink?.click()
        ]);
    }
    async getOnlineUsersCount(): Promise<number> {
        return await this.onlineUsersCount.count();
    }

    async getSenderDivAtConversationsBar(userShortName: string): Promise<Locator> {
        return await this.page.locator(`span.font-medium:has-text("${userShortName}")`)
    }

    async getMessageReceivedByText(text: string): Promise<Locator> {
        return await this.page.locator(`.bg-gray-500 div:has-text("${text}")`).last();
    }

    async getMessageSentByText(text: string): Promise<Locator> {
        return await this.page.locator(`.bg-green-500 div:has-text("${text}")`).last();
    }
    async getDeleteButtonByMessageText(text: string): Promise<Locator> {
        return await this.page.locator(`//div[text()="${text}"]/parent::div/following-sibling::button`).last();
    }

    async getUserFromListByUsername(username: string): Promise<Locator> {
        const firstCapitalizedUsername = username.charAt(0).toUpperCase() + username.slice(1);
        const locator = this.page.locator('.text-gray-900').filter({ hasText: firstCapitalizedUsername });
        await locator.waitFor({ state: 'visible', timeout: 10000 });
        return locator;
    }

    async leaveChatRoom(): Promise<void> {
        const isInDropdownButtonVisible = await this.dropdownButton.isVisible();
        if (isInDropdownButtonVisible) {
            await this.dropdownButton.click();
            await this.leaveRoomButton.click();
            await expect(this.page.locator('h4:has-text("No conversation selected")')).toBeVisible();
        }
    }

    async getNotificationDiv(username: string): Promise<Locator> {
        const firstCapitalizedUsername = username.charAt(0).toUpperCase() + username.slice(1);
        const listItem = this.page.locator('li').filter({
            has: this.page.locator(`span.font-medium:has-text("${firstCapitalizedUsername}")`)
        }).first();

        await listItem.waitFor();
        return listItem.locator('div[id^="notificationCount-"]');
    }

    async waitForNotificationCount(username: string, expectedCount: number, timeout: number = 10000): Promise<void> {
        const notificationsDiv = await this.getNotificationDiv(username);
        await notificationsDiv.waitFor({ timeout });
        await expect(notificationsDiv).toHaveText(expectedCount.toString(), { timeout });
    }

    getLastImageSent(): Locator {
        return this.page.locator('.bg-green-500 img').last().locator('img');
    }

}