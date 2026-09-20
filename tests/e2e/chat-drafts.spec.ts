import { expect } from '@playwright/test';
import { customTest } from '../fixtures/test-base';
import dataSet from "../Data/usersTestData.json" with { type: "json" };

customTest.describe('Draft persistence per conversation', () => {

    customTest('Switching conversations restores the in-progress draft', async ({ authPage, loginData }) => {
        const otherUsers = dataSet.filter(user => user.username !== loginData.username);
        const firstRecipient = otherUsers[0]?.username.split('@')[0] || '';
        const secondRecipient = otherUsers[1]?.username.split('@')[0] || '';
        const draftForFirst = `draft-for-${firstRecipient}-${Date.now()}`;
        const draftForSecond = `draft-for-${secondRecipient}-${Date.now()}`;

        await authPage.getLoginPage().navigateToLoginPage();
        const chat = authPage.getChatPage();

        await chat.ensureConversation(firstRecipient);
        await chat.messageInput.fill(draftForFirst);

        await chat.ensureConversation(secondRecipient);
        await expect(chat.messageInput).not.toHaveValue(draftForFirst);
        await chat.messageInput.fill(draftForSecond);

        await (await chat.selectUser(firstRecipient)).click();
        await expect(chat.messageInput).toHaveValue(draftForFirst);

        await (await chat.selectUser(secondRecipient)).click();
        await expect(chat.messageInput).toHaveValue(draftForSecond);
    });

    customTest('Draft survives a page refresh', async ({ authPage, loginData }) => {
        const anotherLoginData = dataSet.find(user => user.username !== loginData.username);
        const recipient = anotherLoginData?.username.split('@')[0] || '';
        const draftText = `persisted-draft-${Date.now()}`;

        await authPage.getLoginPage().navigateToLoginPage();
        const chat = authPage.getChatPage();
        await chat.ensureConversation(recipient);
        await chat.messageInput.fill(draftText);

        await chat.page.reload();
        await (await chat.selectUser(recipient)).click();
        await expect(chat.messageInput).toHaveValue(draftText);
    });

    customTest('Sending a message clears the stored draft', async ({ authPage, loginData }) => {
        const anotherLoginData = dataSet.find(user => user.username !== loginData.username);
        const recipient = anotherLoginData?.username.split('@')[0] || '';
        const messageText = `sent-clears-draft-${Date.now()}`;

        await authPage.getLoginPage().navigateToLoginPage();
        const chat = authPage.getChatPage();
        await chat.ensureConversation(recipient);
        await chat.sendMessage(messageText);
        await expect(chat.messageInput).toHaveValue('');

        await chat.page.reload();
        await (await chat.selectUser(recipient)).click();
        await expect(chat.messageInput).toHaveValue('');
    });
});
