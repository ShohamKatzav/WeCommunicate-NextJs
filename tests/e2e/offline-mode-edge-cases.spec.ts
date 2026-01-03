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
    }
};

customTest.describe('Offline Mode - Separated Scenarios', () => {
    customTest.use({ storageState: 'tests/state1.json' });

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
        await chat.sendMessageAndWaitForSync(TEST_MESSAGES.SEND, context);
        await expect(chat.pendingMessageIndicator).toHaveCount(0, { timeout: 10000 });
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
        await chat.sendMessageAndWaitForSync(TEST_MESSAGES.DELETE, context, false);
        await expect(chat.pendingMessageIndicator).toHaveCount(0);

        // Offline Action
        await context.setOffline(true);
        const msg = chat.getMessageSentByText(TEST_MESSAGES.DELETE);
        await msg.hover();
        await chat.getDeleteButtonByMessageText(TEST_MESSAGES.DELETE).click();
        await expect(chat.messageDeletingOfflineWarning).toBeVisible();

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
                await chat.sendMessageAndWaitForSync(text, context);
            }

            await chat.reconnectAndVerifySync(context);
            await expect(chat.pendingMessageIndicator).toHaveCount(0, { timeout: 30000 });
            await expect(chat.lastMessageSent).toContainText('Msg 3');
        });
    });
});



