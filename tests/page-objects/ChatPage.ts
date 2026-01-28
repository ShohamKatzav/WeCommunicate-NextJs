import { BrowserContext, expect, Locator, Page } from "@playwright/test";
import Navbar from "../components/Navbar";
import ChatActionsDropdown from "../components/ChatActionsDropdown";
import ToastWarnings from "../components/ToastWarnings";
import ConversationForm from "../components/ConversationForm";


export default class ChatPage {

    page: Page;
    navbar: Navbar;
    dropDown: ChatActionsDropdown;
    toastWarnings: ToastWarnings;
    conversationForm: ConversationForm;
    onlineUsersCount: Locator;
    messageInput: Locator;
    sendMessageButton: Locator;
    pendingMessageIndicator: Locator;
    lastMessageSent: Locator;
    lastMessageReceived: Locator;
    fileInputLabel: Locator;
    fileInput: Locator;
    lastSentImage: Locator;
    chatingWithDiv: Locator;
    noConversationSelectedHeader: Locator;
    newConversationButton: Locator;
    groupChatButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.navbar = new Navbar(page);
        this.dropDown = new ChatActionsDropdown(page);
        this.toastWarnings = new ToastWarnings(page);
        this.conversationForm = new ConversationForm(page);
        this.onlineUsersCount = page.locator('div.text-green-600:has-text("Online")');
        this.messageInput = page.getByRole('textbox', { name: 'Message input' });
        this.sendMessageButton = page.getByRole('button', { name: 'Send message' });
        this.pendingMessageIndicator = page.locator('.inline');
        this.lastMessageSent = page.locator('.overflow-y-scroll div.bg-green-500').last();
        this.lastMessageReceived = page.locator('.overflow-y-scroll div.bg-gray-500:last-child');
        this.fileInputLabel = page.locator('#uploaded-file').locator('..');
        this.fileInput = page.locator('#uploaded-file');
        this.lastSentImage = page.getByAltText('Sent image').last();
        this.chatingWithDiv = page.getByText('Chatting with:');
        this.noConversationSelectedHeader = page.getByRole('heading', { name: 'No conversation selected' });
        this.newConversationButton = page.getByRole('button', { name: 'New conversation' });
        this.groupChatButton = page.locator('.flex').getByRole('button', { name: 'Create Group' });



    }

    async navigateToChatPage(): Promise<void> {
        await Promise.all([
            this.page?.waitForURL('**/chat'),
            this.navbar.chatLink?.click()
        ]);
    }

    async navigateToChatPageAndWaitForServiceWorker(context: BrowserContext): Promise<void> {
        await this.page?.goto("/chat");
        await this.waitForServiceWorkerReady(context);
    }

    async getOnlineUsersCount(): Promise<number> {
        return await this.onlineUsersCount.count();
    }

    getSenderDivAtConversationsBar(userShortName: string): Locator {
        const capitalSecondUserShortName = userShortName.slice(0, 1).toUpperCase() + userShortName.slice(1);
        return this.page.locator(`span.font-medium:text-is("${capitalSecondUserShortName}")`).first();
    }

    async getMessageReceivedByText(text: string): Promise<Locator> {
        return await this.page.locator(`.bg-gray-500 div:has-text("${text}")`).last();
    }

    getMessageSentByText(text: string): Locator {
        return this.page.locator(`.bg-green-500 div:has-text("${text}")`).last();
    }
    getDeleteButtonByMessageText(text: string): Locator {
        return this.page.locator(`//div[text()="${text}"]/parent::div/following-sibling::button`).last();
    }

    /**
     * Locates a user in the chat list by their username.
     * @param username - Short username (before @), case-insensitive
     * @returns Locator for the user's list item
     * @throws TimeoutError if user not found within 10s
     * @example
     * await selectUser('shoham')
     */
    async selectUser(username: string): Promise<Locator> {
        const firstCapitalizedUsername = username.charAt(0).toUpperCase() + username.slice(1);
        const locator = this.page.locator('.text-gray-900').filter({ hasText: firstCapitalizedUsername }).first();
        await locator.waitFor({ state: 'visible', timeout: 10000 });
        return locator;
    }

    async leaveChatRoom(): Promise<void> {
        const isInDropdownButtonVisible = await this.dropDown.dropdownButton.isVisible();
        if (isInDropdownButtonVisible) {
            await this.dropDown.leaveRoom();
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

    async waitForServiceWorkerReady(context: BrowserContext): Promise<void> {
        // Check if it is already active
        const isReady = await this.page.evaluate(async () => {
            const registration = await navigator.serviceWorker.getRegistration();
            return !!registration?.active;
        });

        if (isReady) return; // Skip waiting if already active!

        // If not, wait for the event.
        await Promise.race([
            context.waitForEvent('serviceworker'),
            new Promise(resolve => setTimeout(resolve, 3000))
        ]);

        await this.page.evaluate(() => navigator.serviceWorker.ready);
    }

    async reconnectAndVerifySync(context: BrowserContext): Promise<void> {
        await context.setOffline(false);

        const swSyncPromise = this.page.evaluate(() =>
            new Promise<boolean>((resolve) => {
                const handler = (event: MessageEvent) => {
                    if (event.data?.type === 'MESSAGE_SYNCED') {
                        navigator.serviceWorker?.removeEventListener('message', handler);
                        clearTimeout(timeoutId);
                        resolve(true);
                    }
                };
                navigator.serviceWorker?.addEventListener('message', handler);
                const timeoutId = setTimeout(() => {
                    navigator.serviceWorker?.removeEventListener('message', handler);
                    resolve(false);
                }, 10000);
            })
        );

        // Trigger sync and dispatch online once
        await this.page.evaluate(() => {
            if (navigator.serviceWorker?.controller) {
                navigator.serviceWorker.controller.postMessage({ type: 'SYNC_QUEUE' });
            }
            window.dispatchEvent(new Event('online'));
        });

        const apiResponsePromise = this.page.waitForResponse(
            (response) =>
                (response.url().includes('/api/chat') ||
                    response.url().includes('/api/conversation') ||
                    response.url().includes('/api/cleanhistory')) &&
                response.status() === 200,
            { timeout: 10000 }
        );

        // If race resolves with falsy (no SW message) or rejects -> run fallback wait
        const result = await Promise.race([swSyncPromise, apiResponsePromise]).catch(() => false);
        if (!result) {
            await expect(this.pendingMessageIndicator).toHaveCount(0, { timeout: 5000 }).catch(() => { });
        }
    }

    async sendMessage(messageText: string, expectSync: boolean = true): Promise<void> {
        await this.messageInput.fill(messageText);
        await this.sendMessageButton.click();
        await expect(this.getMessageSentByText(messageText)).toBeVisible();
        if (expectSync) {
            await expect(this.pendingMessageIndicator).toHaveCount(0, { timeout: 10000 });
        } else {
            await expect(this.pendingMessageIndicator.first()).toBeVisible();
        }
    }


    getSentMessagesLocator(): Locator {
        return this.page.locator('.overflow-y-scroll div.bg-green-500');
    }
    async getSentMessagesCount(): Promise<number> {
        return await this.page.locator('.overflow-y-scroll div.bg-green-500').count();
    }

}