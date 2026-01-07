import { expect } from '@playwright/test';
import { customTest } from '../fixtures/test-base';
import dataSet from "../Data/usersTestData.json" with { type: "json" };

customTest.describe('Checking conversation actions done by the dropdown', () => {

    let secondUserShortName: string;

    customTest.beforeEach(async ({ authPage, loginData }) => {
        await authPage.getLoginPage().navigateToLoginPage();
        const anotherLoginData = dataSet.find(user => user.username !== loginData.username);
        secondUserShortName = anotherLoginData?.username.split('@')[0] || '';
        await (await authPage.getChatPage().selectUser(secondUserShortName)).click();
    });

    customTest('Leaving room successfuly', async ({ authPage }) => {
        await expect(authPage.getChatPage().chatingWithDiv).toBeVisible();
        await authPage.getChatPage().dropDown.leaveRoom();
        await expect(authPage.getChatPage().noConversationSelectedHeader).toBeVisible();
    });

    customTest('Clean room history', async ({ authPage }) => {
        await authPage.getChatPage().sendMessage('Clean history test');
        expect(await authPage.getChatPage().getSentMessagesCount()).toBeGreaterThan(0);
        await authPage.getChatPage().dropDown.clearHistory();
        await authPage.page.waitForLoadState('networkidle');
        expect(await authPage.getChatPage().getSentMessagesCount()).toEqual(0);
    });

    customTest('Delete conversation', async ({ authPage }) => {
        await authPage.getChatPage().sendMessage('Delete conversation test');
        const conversationRowByParticipantName = authPage.getChatPage().getSenderDivAtConversationsBar(secondUserShortName);
        await expect(conversationRowByParticipantName).toBeVisible();
        await authPage.getChatPage().dropDown.deleteConversation();
        await expect(conversationRowByParticipantName).not.toBeVisible();
    });
});


customTest.describe('Checking conversation actions done by conversation bar', () => {

    customTest.beforeEach(async ({ authPage }) => {
        await authPage.getLoginPage().navigateToLoginPage();
    });

    customTest('Start single participant chat', async ({ authPage }) => {
        const chat = authPage.getChatPage();
        await chat.newConversationButton.click();
        const participantName = await chat.conversationForm.participantLabel.first().textContent() || '';
        await chat.conversationForm.participantLabel.first().click();
        await chat.conversationForm.startChattingButton.click();
        await expect(chat.chatingWithDiv).toContainText(participantName);
    });

    customTest('Start a group chat', async ({ authPage }) => {
        const chat = authPage.getChatPage();
        await chat.groupChatButton.click();
        const firstParticipantName = await chat.conversationForm.participantLabel.first().textContent() || '';
        const secondParticipantName = await chat.conversationForm.participantLabel.nth(1).textContent() || '';
        await chat.conversationForm.participantLabel.first().click();
        await chat.conversationForm.participantLabel.nth(1).click();
        await chat.conversationForm.createGroupButton.click();
        await expect(chat.chatingWithDiv).toContainText(firstParticipantName);
        await expect(chat.chatingWithDiv).toContainText(secondParticipantName);
    });

});