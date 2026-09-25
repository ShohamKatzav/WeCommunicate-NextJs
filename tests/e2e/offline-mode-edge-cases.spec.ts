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
        await authPage.page.goto('/chat', { waitUntil: 'domcontentloaded' });
        // reload to ensure service worker / client mount state updates under offline
        await authPage.page.reload();
        await expect(authPage.getOfflinePage().offlineHeader).toBeVisible();

    });

    customTest('@Offline mode - @Navigate to locations page', async ({ context, authPage }) => {
        await authPage.page.goto('/about');
        await expect(authPage.getAboutPage().aboutHeader).toBeVisible();
        await context.setOffline(true);
        await authPage.page.goto('/locations', { waitUntil: 'domcontentloaded' });
        // reload to ensure service worker / client mount state updates under offline
        await authPage.page.reload();
        await expect(authPage.getOfflinePage().offlineHeader).toBeVisible();

    });

    customTest('@Offline mode - @Navigate to moderator page', async ({ context, authPage }) => {
        await authPage.page.goto('/about');
        await expect(authPage.getAboutPage().aboutHeader).toBeVisible();
        await context.setOffline(true);
        await authPage.page.goto('/moderator', { waitUntil: 'domcontentloaded' });
        // reload to ensure service worker / client mount state updates under offline
        await authPage.page.reload();
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
        await chat.ensureConversation(recipientShortName);
        await expect(chat.messageInput).toBeVisible({ timeout: 10000 });

        await context.setOffline(true);
        await chat.sendMessage(OFFLINE_TESTS_DATA.SEND_TEST.test_message, false);
        await expect(chat.toastWarnings.messageSendingOfflineWarning).toBeVisible();
        await chat.reconnectAndVerifySync(context);
        await expect(chat.getSentMessagesLocator()).toContainText(OFFLINE_TESTS_DATA.SEND_TEST.test_message);
    });

    /**
    * The IndexedDB queue used to be invisible, so failed/offline sends just
    * vanished. The amber tray is the user-facing outbox for that queue.
    */
    customTest('@Offline mode - Pending outbox lists queued messages until they sync', async ({ context, authPage }) => {
        const { recipient } = OFFLINE_TESTS_DATA.SEND_TEST;
        const queuedText = `outbox-${Date.now()}`;
        const chat = authPage.getChatPage();
        const recipientShortName = recipient.split('@')[0];

        await chat.ensureConversation(recipientShortName);
        await expect(chat.messageInput).toBeVisible({ timeout: 10000 });

        await context.setOffline(true);
        await chat.sendMessage(queuedText, false);
        await expect(chat.toastWarnings.messageSendingOfflineWarning).toBeVisible();
        await expect(chat.outboxToggle).toBeVisible({ timeout: 10000 });
        await expect(chat.outboxToggle).toContainText('1 pending item');

        await chat.outboxToggle.click();
        await expect(chat.getOutboxItem(queuedText)).toBeVisible();
        await expect(chat.retryOutboxButton).toBeVisible();

        await chat.reconnectAndVerifySync(context);
        await expect(chat.getSentMessageByText(queuedText)).toBeVisible();
        await expect(chat.outboxToggle).toHaveCount(0, { timeout: 10000 });
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
        await chat.ensureConversation(recipientShortName);

        // Online Setup
        await chat.sendMessage(OFFLINE_TESTS_DATA.DELETE_TEST.test_message);
        await expect(chat.pendingMessageIndicator).toHaveCount(0);

        // Offline Action
        await context.setOffline(true);
        const msg = chat.getMessageSentByText(OFFLINE_TESTS_DATA.DELETE_TEST.test_message);
        await chat.openMessageActions(msg);
        const delButton = chat.getMessageActionsDeleteButton();
        await Promise.all([
            expect(chat.toastWarnings.messageDeletingOfflineWarning).toBeVisible(),
            delButton.click()
        ]);

        // Reconnect & Verify
        await chat.reconnectAndVerifySync(context);
        await expect(chat.getSentMessageByText(OFFLINE_TESTS_DATA.DELETE_TEST.confirm_message)).toBeVisible();
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

            await chat.ensureConversation(recipientShortName);
            await context.setOffline(true);
            for (const text of OFFLINE_TESTS_DATA.QUEUE_TEST.test_messages) {
                await chat.sendMessage(text, false);
                await expect(chat.toastWarnings.messageSendingOfflineWarning).toBeVisible();
            }
            await chat.reconnectAndVerifySync(context);
            await expect(chat.pendingMessageIndicator).toHaveCount(0, { timeout: 10000 });
            await expect(chat.getSentMessageByText('Msg 3')).toBeVisible();
        });
    });

    /**
    * Test: Clearing history while offline hides it immediately - on the open
    * transcript and the bar preview - with no reload and no reconnect
    * needed, and that stays true across reopening the room offline,
    * reconnecting and reloading. A message sent after the clear (even one
    * still queued) survives all of that; a message queued before the clear
    * does not come back once the offline queue replays it.
    */
    customTest.describe('Conversation clean history', () => {
        customTest.use({ storageState: 'tests/state3.json' });
        customTest('@Offline mode - Clearing history while offline hides it immediately and survives reopen, reconnect and reload', async ({ context, authPage }) => {
            const { recipient } = OFFLINE_TESTS_DATA.CONVERSATION_CLEAN_HISTORY_TEST;
            const chat = authPage.getChatPage();
            const recipientShortName = recipient.split('@')[0];

            const beforeClearMessage = `before-clear-${Date.now()}`;
            const queuedBeforeClearMessage = `queued-before-clear-${Date.now()}`;
            const afterClearMessage = `after-clear-${Date.now()}`;

            await chat.ensureConversation(recipientShortName);
            await chat.sendMessage(beforeClearMessage);
            expect(await chat.getSentMessagesLocator().count()).toBeGreaterThanOrEqual(1);

            await context.setOffline(true);

            // Queued before the clear - the offline queue processes this
            // ahead of the clear (FIFO), so it must not come back once that
            // replays too.
            await chat.sendMessage(queuedBeforeClearMessage, false);
            await expect(chat.toastWarnings.messageSendingOfflineWarning).toBeVisible();

            await Promise.all([
                expect(chat.toastWarnings.messageCleaningHistoryOfflineWarning).toBeVisible(),
                chat.dropDown.clearHistory()
            ]);

            // Gone immediately - no reload, no reconnect. The bar preview
            // for this room is empty too.
            await expect(chat.getSentMessagesLocator()).toHaveCount(0);
            const conversationRow = chat.getConversationRow(recipientShortName);
            await expect(conversationRow).not.toContainText(beforeClearMessage);
            await expect(conversationRow).not.toContainText(queuedBeforeClearMessage);

            // Leave and reopen the room while still offline - still empty.
            await chat.leaveChatRoom();
            await chat.ensureConversation(recipientShortName);
            await expect(chat.getSentMessagesLocator()).toHaveCount(0);

            // Sent after the clear, while still offline - stays visible.
            await chat.sendMessage(afterClearMessage, false);
            await expect(chat.getSentMessageByText(afterClearMessage)).toBeVisible();

            // Reconnect, then reload - the pre-clear messages (including the
            // one queued before the clear) are still gone; the post-clear
            // one is still there. Three items are queued here (the pre-clear
            // send, the clear itself, the post-clear send), and
            // reconnectAndVerifySync's race resolves on the first of them to
            // sync - wait for the pending indicator to fully clear too (same
            // pattern the multi-message queue-depth test above uses) so the
            // reload below doesn't race the later items still in flight.
            await chat.reconnectAndVerifySync(context);
            await expect(chat.pendingMessageIndicator).toHaveCount(0, { timeout: 10000 });
            // The pending indicator clearing confirms the client got the
            // MESSAGE_SYNCED response, but the cluster's own replication can
            // still briefly lag behind that acknowledged write - reload
            // straight into that gap and the post-clear message intermittently
            // reads back missing. A short settle avoids racing that.
            await chat.page.waitForTimeout(2000);
            await chat.page.reload();
            await chat.ensureConversation(recipientShortName);
            await expect(chat.getSentMessagesLocator()).toHaveCount(1);
            await expect(chat.getSentMessageByText(afterClearMessage)).toBeVisible();
            await expect(chat.page.getByText(beforeClearMessage)).toHaveCount(0);
            await expect(chat.page.getByText(queuedBeforeClearMessage)).toHaveCount(0);
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
            await chat.ensureConversation(recipientShortName);
            await chat.sendMessage(OFFLINE_TESTS_DATA.SEND_TEST.test_message);

            await context.setOffline(true);
            await chat.dropDown.deleteConversation();
            await expect(chat.dropDown.deletionModalClosed()).resolves.toBe(true);
            await chat.toastWarnings.conversationDeletingOfflineWarning.waitFor({ state: 'visible', timeout: 5000 });
            await expect(chat.getSenderDivAtConversationsBar(recipientShortName)).not.toBeVisible();
        });
    });
});



