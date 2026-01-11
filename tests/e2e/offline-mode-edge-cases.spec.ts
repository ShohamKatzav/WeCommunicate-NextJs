import { expect } from '@playwright/test';
import { customTest } from '../fixtures/test-base';

const TEST_MESSAGES = {
    SEND: 'Sending message while offline',
    DELETE: 'Delete this message offline',
    CONFIRM: 'You deleted this message',
} as const;

const USERS = {
    SEND_PAIR: {
        sender: 'shoham@gmail.com',
        recipient: 'skgladiator3@gmail.com'
    },
    DELETE_PAIR: {
        sender: 'shoham@gmail.com',
        recipient: 'skgladiator4@gmail.com'
    },
    QUEUE_PAIR: {
        sender: 'skgladiator3@gmail.com',
        recipient: 'skgladiator4@gmail.com'
    },
    CONVERSATION_ACTIONS: {
        sender: 'shoham@gmail.com',
        recipient: 'skgladiator5@gmail.com'
    },

};

customTest.describe('Offline Mode - Separated Scenarios', () => {
    customTest.beforeEach(async ({ context, authPage }) => {
        await authPage.getChatPage().navigateToChatPageAndWaitForServiceWorker(context);
    });

    customTest.afterEach(async ({ context }) => {
        await context.setOffline(false);
    });

    customTest('@Offline mode - @Navigate to chat page', async ({ context, authPage }) => {
        await authPage.page.goto('/about');
        await expect(authPage.getAboutPage().aboutHeader).toBeVisible();
        await context.setOffline(true);
        await authPage.getChatPage().navbar.chatLink.click();
        await expect(authPage.getOfflinePage().offlineHeader).toBeVisible();

    });

    customTest('@Offline mode - @Navigate to locations page', async ({ context, authPage }) => {
        await authPage.page.goto('/about');
        await expect(authPage.getAboutPage().aboutHeader).toBeVisible();
        await context.setOffline(true);
        await authPage.getChatPage().navbar.locationsLink.click();
        await expect(authPage.getOfflinePage().offlineHeader).toBeVisible();

    });
    /**
    * Test: Sending a message while offline should queue it and send when reconnected
    *
    * Flow:
    * 1. Navigate to chat and wait for service worker
    * 2. Go offline
    * 3. Send message - should show warning
    * 4. Reconnect - message should send automatically
    * 5. Verify message appears in chat
    **/
    customTest('@Offline mode - Message should queue and send when back online', async ({ context, authPage }) => {
        const { recipient } = USERS.SEND_PAIR;
        const chat = authPage.getChatPage();

        const recipientShortName = recipient.split('@')[0];
        await (await chat.selectUser(recipientShortName)).click();

        await context.setOffline(true);
        await chat.sendMessage(TEST_MESSAGES.SEND, false);
        await expect(chat.toastWarnings.messageSendingOfflineWarning).toBeVisible();
        await chat.reconnectAndVerifySync(context);
        await expect(chat.lastMessageSent).toContainText(TEST_MESSAGES.SEND);
    });

    /**
    * Test: Deleting a message while offline should queue deletion and process when reconnected
    *
    * Flow:
    * 1. Navigate to chat with existing message
    * 2. Go offline
    * 3. Delete message - should show warning
    * 4. Reconnect - deletion should process
    * 5. Verify deletion confirmation appears
    **/
    customTest('@Offline mode - Existing message should queue for deletion while offline', async ({ context, authPage }) => {
        const { recipient } = USERS.DELETE_PAIR;
        const chat = authPage.getChatPage();

        const recipientShortName = recipient.split('@')[0];
        await (await chat.selectUser(recipientShortName)).click();

        // Online Setup
        await chat.sendMessage(TEST_MESSAGES.DELETE);
        await expect(chat.pendingMessageIndicator).toHaveCount(0);

        // Offline Action
        await context.setOffline(true);
        const msg = chat.getMessageSentByText(TEST_MESSAGES.DELETE);
        await msg.hover();
        const delButton = chat.getDeleteButtonByMessageText(TEST_MESSAGES.DELETE);
        await Promise.all([
            expect(chat.toastWarnings.messageDeletingOfflineWarning).toBeVisible(),
            delButton.click()
        ]);

        // Reconnect & Verify
        await chat.reconnectAndVerifySync(context);
        await expect(chat.lastMessageSent).toContainText(TEST_MESSAGES.CONFIRM);
    });

    /**
    * Test: Multiple offline operations should queue properly
    *
    * Tests that the offline queue can handle multiple operations
    * and processes them in order when reconnected
    */
    customTest.describe('Queue Depth Scenario', () => {
        customTest.use({ storageState: 'tests/state2.json' });
        customTest('@Offline mode - Multiple messages should queue in order', async ({ context, authPage }) => {
            const pair = USERS.QUEUE_PAIR;
            const chat = authPage.getChatPage();

            const recipientShortName = pair.recipient.split('@')[0];
            await (await chat.selectUser(recipientShortName)).click();

            await context.setOffline(true);
            const batch = ['Msg 1', 'Msg 2', 'Msg 3'];
            for (const text of batch) {
                await chat.sendMessage(text, false);
                await expect(chat.toastWarnings.messageSendingOfflineWarning).toBeVisible();
            }
            await chat.reconnectAndVerifySync(context);
            await expect(chat.lastMessageSent).toContainText('Msg 3');
        });
    });

    customTest('@Offline mode - Messages should dissapear after refresh when cleaning history while offline', async ({ context, authPage }) => {
        const { recipient } = USERS.CONVERSATION_ACTIONS;
        const chat = authPage.getChatPage();

        const recipientShortName = recipient.split('@')[0];
        await (await chat.selectUser(recipientShortName)).click();
        await chat.sendMessage(TEST_MESSAGES.SEND);
        expect(await chat.getSentMessagesLocator().count()).toBeGreaterThan(1);
        await context.setOffline(true);
        await Promise.all([
            expect(chat.toastWarnings.messageCleaningHistoryOfflineWarning).toBeVisible(),
            chat.dropDown.clearHistory()
        ]);
        await chat.reconnectAndVerifySync(context);
        await chat.page.reload();
        await (await chat.selectUser(recipientShortName)).click();
        await expect(chat.getSentMessagesLocator()).toHaveCount(0);
    });

    customTest('@Offline mode - Conversation should dissapear when deleting it while offline', async ({ context, authPage }) => {
        const { recipient } = USERS.CONVERSATION_ACTIONS;
        const chat = authPage.getChatPage();

        const recipientShortName = recipient.split('@')[0];
        await (await chat.selectUser(recipientShortName)).click();

        await context.setOffline(true);
        await chat.dropDown.deleteConversation();
        await expect(chat.toastWarnings.conversationDeletingOfflineWarning).toBeVisible();

        await expect(chat.getSenderDivAtConversationsBar(recipient)).not.toBeVisible();
    });
});



