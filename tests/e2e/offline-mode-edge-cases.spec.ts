import { expect } from '@playwright/test';
import { customTest } from '../fixtures/test-base';
import OFFLINE_TESTS_DATA from "../Data/scenariosData.json" with { type: "json" };

customTest.describe('Offline Mode - Separated Scenarios', () => {
    customTest.beforeEach(async ({ context, authPage }) => {
        await authPage.getChatPage().navigateToChatPageAndWaitForServiceWorker(context);
        await authPage.page.waitForLoadState('networkidle');
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
        const { recipient } = OFFLINE_TESTS_DATA.SEND_TEST;
        const chat = authPage.getChatPage();

        const recipientShortName = recipient.split('@')[0];
        await (await chat.selectUser(recipientShortName)).click();

        await context.setOffline(true);
        await chat.sendMessage(OFFLINE_TESTS_DATA.SEND_TEST.test_message, false);
        await expect(chat.toastWarnings.messageSendingOfflineWarning).toBeVisible();
        await chat.reconnectAndVerifySync(context);
        await expect(chat.lastMessageSent).toContainText(OFFLINE_TESTS_DATA.SEND_TEST.test_message);
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
        const { recipient } = OFFLINE_TESTS_DATA.DELETE_TEST;
        const chat = authPage.getChatPage();

        const recipientShortName = recipient.split('@')[0];
        await (await chat.selectUser(recipientShortName)).click();

        // Online Setup
        await chat.sendMessage(OFFLINE_TESTS_DATA.DELETE_TEST.test_message);
        await expect(chat.pendingMessageIndicator).toHaveCount(0);

        // Offline Action
        await context.setOffline(true);
        const msg = chat.getMessageSentByText(OFFLINE_TESTS_DATA.DELETE_TEST.test_message);
        await msg.hover();
        const delButton = chat.getDeleteButtonByMessageText(OFFLINE_TESTS_DATA.DELETE_TEST.test_message);
        await Promise.all([
            expect(chat.toastWarnings.messageDeletingOfflineWarning).toBeVisible(),
            delButton.click()
        ]);

        // Reconnect & Verify
        await chat.reconnectAndVerifySync(context);
        await expect(chat.lastMessageSent).toContainText(OFFLINE_TESTS_DATA.DELETE_TEST.confirm_message);
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
            const { recipient } = OFFLINE_TESTS_DATA.QUEUE_TEST;
            const chat = authPage.getChatPage();
            const recipientShortName = recipient.split('@')[0];

            await (await chat.selectUser(recipientShortName)).click();
            await context.setOffline(true);
            for (const text of OFFLINE_TESTS_DATA.QUEUE_TEST.test_messages) {
                await chat.sendMessage(text, false);
                await expect(chat.toastWarnings.messageSendingOfflineWarning).toBeVisible();
            }
            await chat.reconnectAndVerifySync(context);
            await expect(chat.pendingMessageIndicator).toHaveCount(0, { timeout: 10000 });
            await expect(chat.lastMessageSent).toContainText('Msg 3');
        });
    });

    /**
    * Test: Messages should dissapear after refresh when cleaning history while offline
    *
    * Tests that the offline queue can handle clean history request
    * and processes it when reconnected
    * Theres no optimistic update here, so after reconnection and reload
    * the messages should be gone
    */
    customTest.describe('Conversation clean history', () => {
        customTest.use({ storageState: 'tests/state3.json' });
        customTest('@Offline mode - Messages should dissapear after refresh when cleaning history while offline', async ({ context, authPage }) => {
            const { recipient } = OFFLINE_TESTS_DATA.CONVERSATION_CLEAN_HISTORY_TEST;
            const chat = authPage.getChatPage();
            const recipientShortName = recipient.split('@')[0];

            await (await chat.selectUser(recipientShortName)).click();
            await chat.sendMessage(OFFLINE_TESTS_DATA.SEND_TEST.test_message);
            expect(await chat.getSentMessagesLocator().count()).toBeGreaterThanOrEqual(1);

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
    });

    /**
    * Test: Conversation should dissapear when deleting it while offline
    *
    * Tests that the offline queue can handle delete conversation request
    * and processes it
    */
    customTest.describe('Conversation delete', () => {
        customTest.use({ storageState: 'tests/state4.json' });
        customTest('@Offline mode - Conversation should dissapear when deleting it while offline', async ({ context, authPage }) => {
            const { recipient } = OFFLINE_TESTS_DATA.CONVERSATION_DELETE_TEST;
            const chat = authPage.getChatPage();
            const recipientShortName = recipient.split('@')[0];
            await (await chat.selectUser(recipientShortName)).click();
            await chat.sendMessage(OFFLINE_TESTS_DATA.SEND_TEST.test_message);

            await context.setOffline(true);
            await chat.dropDown.deleteConversation();
            await expect(chat.dropDown.deletionModalClosed()).resolves.toBe(true);
            chat.toastWarnings.conversationDeletingOfflineWarning.waitFor({ state: 'visible', timeout: 5000 });
            await expect(chat.getSenderDivAtConversationsBar(recipient)).not.toBeVisible();
        });
    });
});



