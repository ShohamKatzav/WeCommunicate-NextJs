# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/offline-mode-edge-cases.spec.ts >> Offline Mode - Separated Scenarios >> @Offline mode - @Navigate to locations page
- Location: tests/e2e/offline-mode-edge-cases.spec.ts:24:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('You\'re offline')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('You\'re offline')

```

```yaml
- img
- heading "You're back online! 🎉" [level=1]
- paragraph:
  - text: Your
  - strong: internet connection
  - text: has been restored
- paragraph: "\"Sometimes you need to disconnect to reconnect.\" — Anonymous"
- text: ✓ Connected
- button "🔄 Retry connection"
- button "❌ Go back"
- list:
  - listitem: Check your WiFi or mobile data
  - listitem: Try airplane mode on/off
  - listitem: Some features may be cached and still work
```

# Test source

```ts
  1   | import { expect } from '@playwright/test';
  2   | import { customTest } from '../fixtures/test-base';
  3   | import OFFLINE_TESTS_DATA from "../Data/scenariosData.json" with { type: "json" };
  4   | 
  5   | customTest.describe('Offline Mode - Separated Scenarios', () => {
  6   |     customTest.beforeEach(async ({ context, authPage }) => {
  7   |         await authPage.getChatPage().navigateToChatPageAndWaitForServiceWorker(context);
  8   |         await authPage.page.waitForLoadState('networkidle');
  9   |     });
  10  | 
  11  |     customTest.afterEach(async ({ context }) => {
  12  |         await context.setOffline(false);
  13  |     });
  14  | 
  15  |     customTest('@Offline mode - @Navigate to chat page', async ({ context, authPage }) => {
  16  |         await authPage.page.goto('/about');
  17  |         await expect(authPage.getAboutPage().aboutHeader).toBeVisible();
  18  |         await context.setOffline(true);
  19  |         await authPage.getChatPage().navbar.chatLink.click();
  20  |         await expect(authPage.getOfflinePage().offlineHeader).toBeVisible();
  21  | 
  22  |     });
  23  | 
  24  |     customTest('@Offline mode - @Navigate to locations page', async ({ context, authPage }) => {
  25  |         await authPage.page.goto('/about');
  26  |         await expect(authPage.getAboutPage().aboutHeader).toBeVisible();
  27  |         await context.setOffline(true);
  28  |         await authPage.getChatPage().navbar.locationsLink.click();
> 29  |         await expect(authPage.getOfflinePage().offlineHeader).toBeVisible();
      |                                                               ^ Error: expect(locator).toBeVisible() failed
  30  | 
  31  |     });
  32  |     /**
  33  |     * Test: Sending a message while offline should queue it and send when reconnected
  34  |     *
  35  |     * Flow:
  36  |     * 1. Navigate to chat and wait for service worker
  37  |     * 2. Go offline
  38  |     * 3. Send message - should show warning
  39  |     * 4. Reconnect - message should send automatically
  40  |     * 5. Verify message appears in chat
  41  |     **/
  42  |     customTest('@Offline mode - Message should queue and send when back online', async ({ context, authPage }) => {
  43  |         const { recipient } = OFFLINE_TESTS_DATA.SEND_TEST;
  44  |         const chat = authPage.getChatPage();
  45  | 
  46  |         const recipientShortName = recipient.split('@')[0];
  47  |         await (await chat.selectUser(recipientShortName)).click();
  48  | 
  49  |         await context.setOffline(true);
  50  |         await chat.sendMessage(OFFLINE_TESTS_DATA.SEND_TEST.test_message, false);
  51  |         await expect(chat.toastWarnings.messageSendingOfflineWarning).toBeVisible();
  52  |         await chat.reconnectAndVerifySync(context);
  53  |         await expect(chat.lastMessageSent).toContainText(OFFLINE_TESTS_DATA.SEND_TEST.test_message);
  54  |     });
  55  | 
  56  |     /**
  57  |     * Test: Deleting a message while offline should queue deletion and process when reconnected
  58  |     *
  59  |     * Flow:
  60  |     * 1. Navigate to chat with existing message
  61  |     * 2. Go offline
  62  |     * 3. Delete message - should show warning
  63  |     * 4. Reconnect - deletion should process
  64  |     * 5. Verify deletion confirmation appears
  65  |     **/
  66  |     customTest('@Offline mode - Existing message should queue for deletion while offline', async ({ context, authPage }) => {
  67  |         const { recipient } = OFFLINE_TESTS_DATA.DELETE_TEST;
  68  |         const chat = authPage.getChatPage();
  69  | 
  70  |         const recipientShortName = recipient.split('@')[0];
  71  |         await (await chat.selectUser(recipientShortName)).click();
  72  | 
  73  |         // Online Setup
  74  |         await chat.sendMessage(OFFLINE_TESTS_DATA.DELETE_TEST.test_message);
  75  |         await expect(chat.pendingMessageIndicator).toHaveCount(0);
  76  | 
  77  |         // Offline Action
  78  |         await context.setOffline(true);
  79  |         const msg = chat.getMessageSentByText(OFFLINE_TESTS_DATA.DELETE_TEST.test_message);
  80  |         await msg.hover();
  81  |         const delButton = chat.getDeleteButtonByMessageText(OFFLINE_TESTS_DATA.DELETE_TEST.test_message);
  82  |         await Promise.all([
  83  |             expect(chat.toastWarnings.messageDeletingOfflineWarning).toBeVisible(),
  84  |             delButton.click()
  85  |         ]);
  86  | 
  87  |         // Reconnect & Verify
  88  |         await chat.reconnectAndVerifySync(context);
  89  |         await expect(chat.lastMessageSent).toContainText(OFFLINE_TESTS_DATA.DELETE_TEST.confirm_message);
  90  |     });
  91  | 
  92  |     /**
  93  |     * Test: Multiple offline operations should queue properly
  94  |     *
  95  |     * Tests that the offline queue can handle multiple operations
  96  |     * and processes them in order when reconnected
  97  |     */
  98  |     customTest.describe('Queue Depth Scenario', () => {
  99  |         customTest.use({ storageState: 'tests/state2.json' });
  100 |         customTest('@Offline mode - Multiple messages should queue in order', async ({ context, authPage }) => {
  101 |             const { recipient } = OFFLINE_TESTS_DATA.QUEUE_TEST;
  102 |             const chat = authPage.getChatPage();
  103 |             const recipientShortName = recipient.split('@')[0];
  104 | 
  105 |             await (await chat.selectUser(recipientShortName)).click();
  106 |             await context.setOffline(true);
  107 |             for (const text of OFFLINE_TESTS_DATA.QUEUE_TEST.test_messages) {
  108 |                 await chat.sendMessage(text, false);
  109 |                 await expect(chat.toastWarnings.messageSendingOfflineWarning).toBeVisible();
  110 |             }
  111 |             await chat.reconnectAndVerifySync(context);
  112 |             await expect(chat.pendingMessageIndicator).toHaveCount(0, { timeout: 10000 });
  113 |             await expect(chat.lastMessageSent).toContainText('Msg 3');
  114 |         });
  115 |     });
  116 | 
  117 |     /**
  118 |     * Test: Messages should dissapear after refresh when cleaning history while offline
  119 |     *
  120 |     * Tests that the offline queue can handle clean history request
  121 |     * and processes it when reconnected
  122 |     * Theres no optimistic update here, so after reconnection and reload
  123 |     * the messages should be gone
  124 |     */
  125 |     customTest.describe('Conversation clean history', () => {
  126 |         customTest.use({ storageState: 'tests/state3.json' });
  127 |         customTest('@Offline mode - Messages should dissapear after refresh when cleaning history while offline', async ({ context, authPage }) => {
  128 |             const { recipient } = OFFLINE_TESTS_DATA.CONVERSATION_CLEAN_HISTORY_TEST;
  129 |             const chat = authPage.getChatPage();
```