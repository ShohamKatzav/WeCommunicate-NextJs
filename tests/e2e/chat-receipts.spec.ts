import { expect } from '@playwright/test';
import { customTest } from '../fixtures/test-base';
import dataSet from "../Data/usersTestData.json" with { type: "json" };

customTest.describe('Delivery and read receipts', () => {
    customTest.describe.configure({ timeout: 45_000 });

    customTest('Sent check becomes Read after the recipient opens the conversation', async ({ authPage, browser, loginData }) => {
        const textToSend = `receipt-${Date.now()}`;
        await authPage.getLoginPage().navigateToLoginPage();
        const anotherLoginData = dataSet.find(user => user.username !== loginData.username);
        const firstUserShortName = loginData.username.split('@')[0];
        const secondUserShortName = anotherLoginData?.username.split('@')[0] || '';
        await (await authPage.getChatPage().selectUser(secondUserShortName)).click();

        const pOManager2 = await authPage.getLoginPage().loginAnotherUser(browser, anotherLoginData!);
        await expect(pOManager2.getChatPage().noConversationSelectedHeader).toBeVisible();

        await authPage.getChatPage().sendMessage(textToSend);
        await expect(authPage.getChatPage().getSentReceipt(textToSend)).toBeVisible();
        await expect(authPage.getChatPage().getReadReceipt(textToSend)).toHaveCount(0);

        await (await pOManager2.getChatPage().selectUser(firstUserShortName)).click();
        await expect(await pOManager2.getChatPage().getMessageReceivedByText(textToSend)).toBeVisible();
        await expect(pOManager2.getChatPage().unreadDivider).toBeVisible();
        await expect(pOManager2.getChatPage().unreadDivider).toContainText('Unread messages');

        await expect(authPage.getChatPage().getReadReceipt(textToSend)).toBeVisible();
        await expect(authPage.getChatPage().getSentReceipt(textToSend)).toHaveCount(0);
    });

    customTest('Unread divider does not reappear after the conversation has already been opened', async ({ authPage, browser, loginData }) => {
        const textToSend = `unread-once-${Date.now()}`;
        await authPage.getLoginPage().navigateToLoginPage();
        const anotherLoginData = dataSet.find(user => user.username !== loginData.username);
        const firstUserShortName = loginData.username.split('@')[0];
        const secondUserShortName = anotherLoginData?.username.split('@')[0] || '';
        await (await authPage.getChatPage().selectUser(secondUserShortName)).click();
        await authPage.getChatPage().leaveChatRoom();

        const pOManager2 = await authPage.getLoginPage().loginAnotherUser(browser, anotherLoginData!);
        await (await pOManager2.getChatPage().selectUser(firstUserShortName)).click();
        await pOManager2.getChatPage().sendMessage(textToSend);

        await expect(authPage.getChatPage().getConversationRow(secondUserShortName)).toContainText(textToSend);
        await (await authPage.getChatPage().selectUser(secondUserShortName)).click();
        await expect(authPage.getChatPage().getReceivedMessageByText(textToSend)).toBeVisible();
        await expect(authPage.getChatPage().unreadDivider).toBeVisible();

        await authPage.getChatPage().leaveChatRoom();
        await (await authPage.getChatPage().selectUser(secondUserShortName)).click();
        await expect(authPage.getChatPage().getReceivedMessageByText(textToSend)).toBeVisible();
        await expect(authPage.getChatPage().unreadDivider).toHaveCount(0);
    });
});
