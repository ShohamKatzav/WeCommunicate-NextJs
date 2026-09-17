import { expect } from '@playwright/test';
import { customTest } from '../fixtures/test-base';
import dataSet from "../Data/usersTestData.json" with { type: "json" };

customTest.describe('Checking conversation actions done by the dropdown', () => {

    let secondUserShortName: string;

    customTest.beforeEach(async ({ authPage, loginData }) => {
        await authPage.getLoginPage().navigateToLoginPage();
        const anotherLoginData = dataSet.find(user => user.username !== loginData.username);
        secondUserShortName = anotherLoginData?.username.split('@')[0] || '';
        const chat = authPage.getChatPage();
        const conversation = chat.getConversationRow(secondUserShortName);

        if (await conversation.count() === 0) {
            await chat.newConversationButton.click();
            await chat.conversationForm.participantLabel
                .filter({ hasText: secondUserShortName })
                .click();
            await chat.conversationForm.startChattingButton.click();
        } else {
            await conversation.click();
        }
    });

    customTest('Leaving room successfuly', async ({ authPage }) => {
        const chat = authPage.getChatPage();
        await expect(chat.dropDown.dropdownButton).toBeVisible();
        await chat.dropDown.leaveRoom();
        await expect(chat.noConversationSelectedHeader).toBeVisible();
    });

    customTest('Clean room history', async ({ authPage }) => {
        await authPage.getChatPage().sendMessage('Clean history test');
        await expect(authPage.getChatPage().getSentMessagesLocator()).not.toHaveCount(0);
        await authPage.getChatPage().dropDown.clearHistory();
        await authPage.page.waitForLoadState('networkidle');
        await expect(authPage.getChatPage().getSentMessagesLocator()).toHaveCount(0);
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
        await expect(chat.conversationInfoDiv).toContainText(participantName);
    });

    customTest('Start a group chat', async ({ authPage }) => {
        const chat = authPage.getChatPage();
        await chat.groupChatButton.click();
        const firstParticipantName = await chat.conversationForm.participantLabel.first().textContent() || '';
        const secondParticipantName = await chat.conversationForm.participantLabel.nth(1).textContent() || '';
        await chat.conversationForm.participantLabel.first().click();
        await chat.conversationForm.participantLabel.nth(1).click();
        await chat.conversationForm.createGroupButton.click();
        await expect(chat.conversationInfoDiv).toContainText('2');
        await chat.dropDown.openConversationDetails();
        await expect(chat.dropDown.conversationDetailsModal).toContainText(firstParticipantName);
        await expect(chat.dropDown.conversationDetailsModal).toContainText(secondParticipantName);
    });

});