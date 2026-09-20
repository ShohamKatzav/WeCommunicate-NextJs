import { expect } from '@playwright/test';
import { customTest } from '../fixtures/test-base';
import dataSet from "../Data/usersTestData.json" with { type: "json" };

customTest.describe('Block a user', () => {
    customTest.describe.configure({ timeout: 45_000 });

    customTest.afterEach(async ({ authPage, loginData }) => {
        const anotherLoginData = dataSet.find(user => user.username !== loginData.username);
        const blockedUser = anotherLoginData?.username.split('@')[0] || '';
        try {
            await authPage.getChatPage().unblockUserIfBlocked(blockedUser);
        } catch {
            // Later chat-serial tests still need to send to this person.
        }
    });

    customTest('Blocking disables the composer until the user is unblocked', async ({ authPage, loginData }) => {
        await authPage.getLoginPage().navigateToLoginPage();
        const anotherLoginData = dataSet.find(user => user.username !== loginData.username);
        const blockedUser = anotherLoginData?.username.split('@')[0] || '';
        const chat = authPage.getChatPage();
        await chat.ensureConversation(blockedUser);

        await chat.blockUser(blockedUser);
        await expect(chat.blockedComposerNotice).toBeVisible();
        await chat.messageInput.fill(`should-not-send-${Date.now()}`);
        await expect(chat.sendMessageButton).toBeDisabled();

        await chat.unblockUserIfBlocked(blockedUser);
        await expect(chat.blockedComposerNotice).toHaveCount(0);
        await expect(chat.getUserRow(blockedUser).getByText('Blocked')).toHaveCount(0);

        const afterUnblock = `after-unblock-${Date.now()}`;
        await chat.sendMessage(afterUnblock);
        await expect(chat.getSentMessageByText(afterUnblock)).toBeVisible();
    });

    customTest('A blocked user cannot deliver a 1:1 message', async ({ authPage, browser, loginData }) => {
        const blockedSend = `blocked-send-${Date.now()}`;
        await authPage.getLoginPage().navigateToLoginPage();
        const anotherLoginData = dataSet.find(user => user.username !== loginData.username);
        const firstUserShortName = loginData.username.split('@')[0];
        const blockedUser = anotherLoginData?.username.split('@')[0] || '';
        const chat = authPage.getChatPage();
        await chat.ensureConversation(blockedUser);

        const otherChat = (await authPage.getLoginPage().loginAnotherUser(browser, anotherLoginData!)).getChatPage();
        await (await otherChat.selectUser(firstUserShortName)).click();

        await chat.blockUser(blockedUser);
        await expect(chat.blockedComposerNotice).toBeVisible();

        await otherChat.messageInput.fill(blockedSend);
        await otherChat.sendMessageButton.click();
        await expect(otherChat.page.getByText('This message could not be delivered.')).toBeVisible();
        await expect(otherChat.getSentMessageByText(blockedSend)).toHaveCount(0);
        await expect(chat.getReceivedMessageByText(blockedSend)).toHaveCount(0);
    });
});
