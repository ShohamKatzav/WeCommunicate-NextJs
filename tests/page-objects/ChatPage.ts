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
    lastMessageReceived: Locator;
    fileInputLabel: Locator;
    fileInput: Locator;
    lastSentImage: Locator;
    conversationInfoDiv: Locator;
    noConversationSelectedHeader: Locator;
    newConversationButton: Locator;
    groupChatButton: Locator;
    searchInput: Locator;
    unreadDivider: Locator;
    recordVoiceButton: Locator;
    cancelVoiceButton: Locator;
    sendVoiceMessageButton: Locator;
    cancelReplyButton: Locator;
    replyPreview: Locator;
    shareToHeader: Locator;
    lastSentAudio: Locator;
    blockedComposerNotice: Locator;
    outboxToggle: Locator;
    retryOutboxButton: Locator;
    bottomPromptStack: Locator;
    notificationsPromptMessage: Locator;
    enableNotificationsButton: Locator;
    laterNotificationsButton: Locator;
    dismissNotificationsButton: Locator;
    startVoiceCallButton: Locator;
    startVideoCallButton: Locator;
    typingIndicator: Locator;

    constructor(page: Page) {
        this.page = page;
        this.navbar = new Navbar(page);
        this.dropDown = new ChatActionsDropdown(page);
        this.toastWarnings = new ToastWarnings(page);
        this.conversationForm = new ConversationForm(page);
        this.onlineUsersCount = page.locator('div.text-success:has-text("Online")');
        this.messageInput = page.getByRole('textbox', { name: 'Message input' });
        this.sendMessageButton = page.getByRole('button', { name: 'Send message' });
        this.pendingMessageIndicator = page.locator('.inline');
        // getByTestId is robust to DOM structure changes (e.g. the delete
        // button no longer being rendered at all for messages you don't
        // own), unlike a CSS :last-child selector, which silently starts
        // matching every received message once its sibling count changes.
        // Matches the same data-testid pattern getSentMessagesLocator() below
        // already uses.
        this.lastMessageReceived = page.getByTestId('received-message').last();
        this.fileInputLabel = page.locator('#uploaded-file').locator('..');
        this.fileInput = page.locator('#uploaded-file');
        this.lastSentImage = page.getByAltText('Sent image').last();
        this.conversationInfoDiv = page.locator('#ConversationInfo');
        this.noConversationSelectedHeader = page.getByRole('heading', { name: 'No conversation selected' });
        this.newConversationButton = page.getByRole('button', { name: 'New conversation' });
        this.groupChatButton = page.locator('.flex').getByRole('button', { name: 'Create Group' });
        this.searchInput = page.getByRole('textbox', { name: 'Search conversations' });
        this.unreadDivider = page.getByTestId('unread-divider');
        this.recordVoiceButton = page.getByRole('button', { name: 'Record voice message' });
        this.cancelVoiceButton = page.getByRole('button', { name: 'Cancel voice message' });
        this.sendVoiceMessageButton = page.getByRole('button', { name: 'Send voice message' });
        this.cancelReplyButton = page.getByRole('button', { name: 'Cancel reply' });
        this.replyPreview = page.getByText(/^Replying to /);
        this.shareToHeader = page.getByRole('heading', { name: 'Share to...' });
        this.lastSentAudio = page.getByTestId('sent-message').locator('audio').last();
        this.blockedComposerNotice = page.getByText("You can't send messages to a blocked user");
        this.outboxToggle = page.getByRole('button', { name: /pending item/ });
        this.retryOutboxButton = page.getByRole('button', { name: 'Retry now' });
        this.bottomPromptStack = page.locator('#bottom-prompt-stack');
        this.notificationsPromptMessage = page.getByText('Get instant alerts for new messages');
        this.enableNotificationsButton = page.getByRole('button', { name: 'Enable' });
        this.laterNotificationsButton = page.getByRole('button', { name: 'Later', exact: true });
        this.dismissNotificationsButton = page.getByRole('button', { name: 'Permanently dismiss notification prompt' });
        // The accessible name is "Start … call with" while the device is
        // present, and "Can't start a … call with …: No … was found" when it
        // isn't. Either way the button is the call control for this chat.
        this.startVoiceCallButton = page.getByRole('button', { name: /voice call with / });
        this.startVideoCallButton = page.getByRole('button', { name: /video call with / });
        this.typingIndicator = page.locator('#ConversationInfo').getByText(/is typing/);
    }

    // Playwright Chromium reports Notification.permission as "denied" (the
    // browser never shows its own prompt under automation). CDP
    // Browser.setPermission(prompt) is a no-op here, so stub the getter to
    // the pre-prompt "default" the soft-ask requires, then remount chat so
    // PushNotificationManager reads it.
    async resetNotificationPermissionToPrompt(): Promise<void> {
        await this.page.addInitScript(() => {
            Object.defineProperty(Notification, 'permission', {
                configurable: true,
                get: () => 'default',
            });
        });
        await this.page.goto('/chat');
    }

    // Chromium refuses the Push API in Playwright's incognito-style contexts
    // (see bottom-prompts.spec.ts), so this puts a fake subscription for
    // `endpoint` behind a granted permission. Its subscribed state lives in
    // sessionStorage, so later navigations in this tab still see it.
    async stubGrantedPush(endpoint: string): Promise<void> {
        await this.page.addInitScript((endpoint) => {
            if (typeof PushManager === 'undefined') return;
            const SUBSCRIBED_KEY = 'e2e:push-subscribed';
            const subscription = {
                endpoint,
                expirationTime: null,
                options: { userVisibleOnly: true, applicationServerKey: null },
                getKey: () => null,
                toJSON: () => ({ endpoint, expirationTime: null, keys: { p256dh: 'e2e', auth: 'e2e' } }),
                unsubscribe: async () => {
                    sessionStorage.removeItem(SUBSCRIBED_KEY);
                    return true;
                },
            } as unknown as PushSubscription;
            Object.defineProperty(Notification, 'permission', {
                configurable: true,
                get: () => 'granted',
            });
            PushManager.prototype.getSubscription = async () =>
                sessionStorage.getItem(SUBSCRIBED_KEY) ? subscription : null;
            PushManager.prototype.subscribe = async () => {
                sessionStorage.setItem(SUBSCRIBED_KEY, '1');
                return subscription;
            };
        }, endpoint);
    }

    async hasPushSubscription(): Promise<boolean> {
        return await this.page.evaluate(async () => {
            const registration = await navigator.serviceWorker.getRegistration();
            return Boolean(await registration?.pushManager.getSubscription());
        });
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

    getConversationRow(username: string): Locator {
        const capitalizedUsername = username.charAt(0).toUpperCase() + username.slice(1);
        return this.page.locator('li').filter({
            has: this.page.locator('span.font-medium', { hasText: capitalizedUsername })
        }).first();
    }

    async getMessageReceivedByText(text: string): Promise<Locator> {
        return await this.page.locator(`.bg-gray-600 div:has-text("${text}")`).last();
    }

    getMessageSentByText(text: string): Locator {
        // Own bubbles no longer carry a fixed .bg-green-700 class - the
        // accent color (see messageBubble.tsx) is now an inline style that
        // defaults to that same green but can be any of the user's chosen
        // accent colors, so this matches on the stable data-testid instead.
        return this.page.getByTestId('sent-message').filter({ hasText: text }).last();
    }
    // A message's actions (react, reply, delete) live in one menu, opened on
    // desktop from the button beside the bubble that shows on hover. The
    // menu is portaled to <body>, so it's located page-wide rather than
    // inside the message row - only one can be open at a time.
    getMessageActionsMenu(): Locator {
        return this.page.getByTestId('message-actions-menu');
    }

    async openMessageActions(bubble: Locator): Promise<void> {
        await bubble.hover();
        await bubble.locator('xpath=..').getByTestId('message-actions-trigger').click();
        await expect(this.getMessageActionsMenu()).toBeVisible();
    }

    getMessageActionsDeleteButton(): Locator {
        return this.getMessageActionsMenu().getByRole('button', { name: 'Delete' });
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
        const locator = this.getConversationRow(username);
        await locator.waitFor({ state: 'visible', timeout: 10000 });
        return locator;
    }

    async ensureConversation(username: string): Promise<void> {
        const conversation = this.getConversationRow(username);

        if (await conversation.count() > 0) {
            await conversation.click();
            return;
        }

        await this.newConversationButton.click();
        await this.conversationForm.participantLabel
            .filter({ hasText: username })
            .click();
        await this.conversationForm.startChattingButton.click();
        await expect(this.dropDown.dropdownButton).toBeVisible();
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
        return this.page.getByTestId('sent-message');
    }

    getSentMessageByText(text: string): Locator {
        return this.getSentMessagesLocator().filter({ hasText: text }).last();
    }

    async getSentMessagesCount(): Promise<number> {
        return await this.getSentMessagesLocator().count();
    }

    getReceivedMessageByText(text: string): Locator {
        return this.page.getByTestId('received-message').filter({ hasText: text }).last();
    }

    getSentReceipt(text: string): Locator {
        return this.getSentMessageByText(text).locator('[aria-label="Sent"]');
    }

    getReadReceipt(text: string): Locator {
        return this.getSentMessageByText(text).locator('[aria-label="Read"]');
    }

    async replyToSentMessage(text: string): Promise<void> {
        await this.openMessageActions(this.getSentMessageByText(text));
        await this.getMessageActionsMenu().getByRole('button', { name: 'Reply' }).click();
        await expect(this.replyPreview).toBeVisible();
    }

    async replyToReceivedMessage(text: string): Promise<void> {
        await this.openMessageActions(this.getReceivedMessageByText(text));
        await this.getMessageActionsMenu().getByRole('button', { name: 'Reply' }).click();
        await expect(this.replyPreview).toBeVisible();
    }

    getEditMessageInput(): Locator {
        return this.page.getByTestId('edit-message-input');
    }

    getEditedLabel(bubble: Locator): Locator {
        return bubble.getByTestId('edited-label');
    }

    // Takes the bubble rather than its text: once a reply quotes a message,
    // the reply's bubble contains that text too.
    async startEditingMessage(bubble: Locator): Promise<void> {
        await this.openMessageActions(bubble);
        await this.getMessageActionsMenu().getByRole('button', { name: 'Edit' }).click();
        await expect(this.getEditMessageInput()).toBeFocused();
    }

    async editMessage(bubble: Locator, newText: string): Promise<void> {
        await this.startEditingMessage(bubble);
        await this.getEditMessageInput().fill(newText);
        await this.page.getByTestId('edit-message-save').click();
        await expect(this.getEditMessageInput()).toHaveCount(0);
        await expect(this.getSentMessageByText(newText)).toBeVisible();
    }

    async searchConversations(query: string): Promise<void> {
        await this.searchInput.fill(query);
    }

    getSearchMatch(text: string): Locator {
        return this.page.locator('div.text-green-700, div.text-green-400').filter({ hasText: text });
    }

    async shareContentViaShareTarget(fields: { title?: string; text?: string; url?: string }): Promise<void> {
        // Use Playwright's request context, not in-page fetch: production's
        // service worker can intercept page fetch() and fail the POST.
        // Do not follow the 303 here - if Location ever points at Render's
        // internal bind address, the API client would hang on localhost.
        // The page navigation below keeps us on the public origin, which is
        // also how the browser resolves a relative/public 303.
        const response = await this.page.request.post('/share-target', {
            multipart: {
                title: fields.title ?? '',
                text: fields.text ?? '',
                url: fields.url ?? '',
            },
            maxRedirects: 0,
        });
        const location = response.headers()['location'];
        if (!location) {
            throw new Error(`share-target returned ${response.status()} with no Location header`);
        }
        const redirected = new URL(location, this.page.url());
        await this.page.goto(`${redirected.pathname}${redirected.search}`, { waitUntil: 'domcontentloaded' });
    }

    async shareContentViaShareTargetGet(fields: { title?: string; text?: string; url?: string }): Promise<void> {
        const params = new URLSearchParams({
            title: fields.title ?? '',
            text: fields.text ?? '',
            url: fields.url ?? '',
        });
        const response = await this.page.request.get(`/share-target?${params.toString()}`, {
            maxRedirects: 0,
        });
        const location = response.headers()['location'];
        if (!location) {
            throw new Error(`share-target GET returned ${response.status()} with no Location header`);
        }
        const redirected = new URL(location, this.page.url());
        await this.page.goto(`${redirected.pathname}${redirected.search}`, { waitUntil: 'domcontentloaded' });
    }

    async attachGeneratedJpeg(): Promise<number> {
        return await this.page.evaluate(async () => {
            const canvas = document.createElement('canvas');
            canvas.width = 2200;
            canvas.height = 2200;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Could not create canvas context');

            const imageData = ctx.createImageData(2200, 2200);
            const pixels = imageData.data;
            for (let i = 0; i < pixels.length; i += 4) {
                pixels[i] = (i * 17 + 31) & 255;
                pixels[i + 1] = (i * 41 + 7) & 255;
                pixels[i + 2] = (i * 13 + 113) & 255;
                pixels[i + 3] = 255;
            }
            ctx.putImageData(imageData, 0, 0);

            const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob((result) => {
                    if (result) resolve(result);
                    else reject(new Error('Failed to encode jpeg'));
                }, 'image/jpeg', 0.95);
            });

            const input = document.getElementById('uploaded-file') as HTMLInputElement | null;
            if (!input) throw new Error('File input not found');

            const file = new File([blob], 'camera-photo.jpg', { type: 'image/jpeg' });
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            input.files = dataTransfer.files;
            input.dispatchEvent(new Event('change', { bubbles: true }));
            return blob.size;
        });
    }

    getUserRow(username: string): Locator {
        const capitalizedUsername = username.charAt(0).toUpperCase() + username.slice(1);
        return this.page.locator('div.p-3.rounded-lg.cursor-pointer').filter({
            has: this.page.locator('div.font-medium', { hasText: capitalizedUsername })
        }).first();
    }

    getBlockButton(username: string): Locator {
        return this.getUserRow(username).getByRole('button', { name: /^Block / });
    }

    getUnblockButton(username: string): Locator {
        return this.getUserRow(username).getByRole('button', { name: /^Unblock / });
    }

    private waitForServerAction(): Promise<unknown> {
        return this.page.waitForResponse((response) =>
            response.request().method() === 'POST' &&
            Boolean(response.request().headers()['next-action']),
            { timeout: 15000 }
        );
    }

    async blockUser(username: string): Promise<void> {
        const row = this.getUserRow(username);
        await expect(row).toBeVisible({ timeout: 10000 });
        await row.scrollIntoViewIfNeeded();
        const serverAction = this.waitForServerAction();
        await this.getBlockButton(username).click();
        await serverAction;
        await expect(this.getUnblockButton(username)).toBeVisible({ timeout: 10000 });
        await expect(row.getByText('Blocked')).toBeVisible();
    }

    async unblockUserIfBlocked(username: string): Promise<void> {
        const unblock = this.getUnblockButton(username);
        if (await unblock.count() === 0) return;
        await this.getUserRow(username).scrollIntoViewIfNeeded();
        if (!(await unblock.isVisible().catch(() => false))) return;
        const serverAction = this.waitForServerAction();
        await unblock.click();
        await serverAction.catch(() => { });
        await expect(this.getBlockButton(username)).toBeVisible({ timeout: 10000 });
    }

    getOutboxItem(text: string): Locator {
        return this.page.getByText(`Message: "${text}"`);
    }

}