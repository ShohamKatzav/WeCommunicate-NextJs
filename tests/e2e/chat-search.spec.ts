import { expect } from '@playwright/test';
import { customTest } from '../fixtures/test-base';
import dataSet from "../Data/usersTestData.json" with { type: "json" };

customTest.describe('Full-text message search', () => {

    customTest('Search finds a message in history and hides conversations that do not match', async ({ authPage, loginData }) => {
        const uniqueToken = `searchtoken${Date.now()}`;
        const messageText = `please find ${uniqueToken} later`;
        await authPage.getLoginPage().navigateToLoginPage();
        const anotherLoginData = dataSet.find(user => user.username !== loginData.username);
        const recipient = anotherLoginData?.username.split('@')[0] || '';
        const chat = authPage.getChatPage();

        await chat.ensureConversation(recipient);
        await chat.sendMessage(messageText);

        await chat.searchConversations(uniqueToken);
        await expect(chat.getConversationRow(recipient)).toBeVisible();
        await expect(chat.getSearchMatch(uniqueToken)).toBeVisible();

        await chat.searchConversations(uniqueToken.slice(0, 8));
        await expect(chat.getConversationRow(recipient)).toBeVisible();
        await expect(chat.getSearchMatch(uniqueToken)).toBeVisible();

        await chat.searchConversations(`zzznomatch${Date.now()}`);
        await expect(chat.getConversationRow(recipient)).toHaveCount(0);

        await chat.searchConversations('');
        await expect(chat.getConversationRow(recipient)).toBeVisible();
    });
});
