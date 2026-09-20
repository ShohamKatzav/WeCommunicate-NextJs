import { expect } from '@playwright/test';
import { customTest } from '../fixtures/test-base';
import dataSet from "../Data/usersTestData.json" with { type: "json" };

customTest.describe('Reply to quoted messages', () => {
    customTest.describe.configure({ timeout: 45_000 });

    customTest('Reply preview can be cancelled, and a sent reply quotes the original for both users', async ({ authPage, browser, loginData }) => {
        const originalText = `quote-me-${Date.now()}`;
        const replyText = `reply-to-quote-${Date.now()}`;
        await authPage.getLoginPage().navigateToLoginPage();
        const anotherLoginData = dataSet.find(user => user.username !== loginData.username);
        const firstUserShortName = loginData.username.split('@')[0];
        const secondUserShortName = anotherLoginData?.username.split('@')[0] || '';
        const chat = authPage.getChatPage();

        await (await chat.selectUser(secondUserShortName)).click();
        await chat.sendMessage(originalText);

        await chat.replyToSentMessage(originalText);
        await expect(chat.replyPreview).toContainText('Replying to yourself');
        await expect(chat.replyPreview.locator('xpath=..')).toContainText(originalText);

        await chat.cancelReplyButton.click();
        await expect(chat.replyPreview).toHaveCount(0);

        await chat.replyToSentMessage(originalText);
        await chat.sendMessage(replyText);
        await expect(chat.replyPreview).toHaveCount(0);
        await expect(chat.getSentMessageByText(replyText)).toContainText(originalText);

        const pOManager2 = await authPage.getLoginPage().loginAnotherUser(browser, anotherLoginData!);
        await (await pOManager2.getChatPage().selectUser(firstUserShortName)).click();
        const receivedReply = pOManager2.getChatPage().getReceivedMessageByText(replyText);
        await expect(receivedReply).toBeVisible();
        await expect(receivedReply).toContainText(originalText);
    });

    customTest('Replying to a received message shows the other person in the preview', async ({ authPage, browser, loginData }) => {
        const incomingText = `incoming-quote-${Date.now()}`;
        const replyText = `replying-to-them-${Date.now()}`;
        await authPage.getLoginPage().navigateToLoginPage();
        const anotherLoginData = dataSet.find(user => user.username !== loginData.username);
        const firstUserShortName = loginData.username.split('@')[0];
        const secondUserShortName = anotherLoginData?.username.split('@')[0] || '';

        const pOManager2 = await authPage.getLoginPage().loginAnotherUser(browser, anotherLoginData!);
        await (await authPage.getChatPage().selectUser(secondUserShortName)).click();
        await (await pOManager2.getChatPage().selectUser(firstUserShortName)).click();
        await pOManager2.getChatPage().sendMessage(incomingText);

        const chat = authPage.getChatPage();
        await expect(chat.getReceivedMessageByText(incomingText)).toBeVisible();
        await chat.replyToReceivedMessage(incomingText);
        await expect(chat.replyPreview).toContainText(`Replying to ${secondUserShortName.charAt(0).toUpperCase()}${secondUserShortName.slice(1)}`);
        await chat.sendMessage(replyText);
        await expect(chat.getSentMessageByText(replyText)).toContainText(incomingText);
    });
});
