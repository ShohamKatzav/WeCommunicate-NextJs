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
        await authPage.getChatPage().dropDown.dropdownButton.click();
        await authPage.getChatPage().dropDown.leaveRoomButton.click();
        await expect(authPage.getChatPage().noConversationSelectedHeader).toBeVisible();
    });

    customTest('Clean room history', async ({ authPage, context }) => {
        await authPage.getChatPage().sendMessageAndWaitForSync('Clean history test', context, false);
        expect(await authPage.getChatPage().getSentMessagesCount()).toBeGreaterThan(0);
        await authPage.getChatPage().dropDown.dropdownButton.click();
        await authPage.getChatPage().dropDown.clearHistoryButton.click();
        await authPage.page.waitForLoadState('networkidle');
        expect(await authPage.getChatPage().getSentMessagesCount()).toEqual(0);
    });

    customTest('Delete conversation', async ({ authPage, context }) => {
        await authPage.getChatPage().sendMessageAndWaitForSync('Delete conversation test', context, false);
        const conversationRowByParticipantName = authPage.getChatPage().getSenderDivAtConversationsBar(secondUserShortName);
        await expect(conversationRowByParticipantName).toBeVisible();
        await authPage.getChatPage().dropDown.dropdownButton.click();
        await authPage.getChatPage().dropDown.deleteConversationButton.click();
        await authPage.getChatPage().dropDown.confirmDeletionButton.click();
        await expect(conversationRowByParticipantName).not.toBeVisible();
    });
});