import { expect } from '@playwright/test';
import { customTest } from '../fixtures/test-base';
import dataSet from "../Data/usersTestData.json" with { type: "json" };

customTest.describe('Edit sent messages', () => {
    customTest.describe.configure({ timeout: 60_000 });

    customTest('An edit replaces the text in place for both users, keeps the send time, and updates quotes of it', async ({ authPage, browser, loginData }) => {
        const originalText = `edit-me-${Date.now()}`;
        const editedText = `edited-${Date.now()}`;
        const replyText = `reply-to-edit-${Date.now()}`;
        await authPage.getLoginPage().navigateToLoginPage();
        const anotherLoginData = dataSet.find(user => user.username !== loginData.username);
        const firstUserShortName = loginData.username.split('@')[0];
        const secondUserShortName = anotherLoginData?.username.split('@')[0] || '';
        const chat = authPage.getChatPage();

        const pOManager2 = await authPage.getLoginPage().loginAnotherUser(browser, anotherLoginData!);
        const chat2 = pOManager2.getChatPage();
        await (await chat.selectUser(secondUserShortName)).click();
        await (await chat2.selectUser(firstUserShortName)).click();

        await chat.sendMessage(originalText);
        await chat.replyToSentMessage(originalText);
        await chat.sendMessage(replyText);
        await expect(chat2.getReceivedMessageByText(replyText)).toContainText(originalText);

        const sentBubble = chat.getSentMessagesLocator().filter({ hasText: originalText }).first();
        // The bubble's last row is its timestamp row ("Edited", time, receipt).
        const timestampBefore = await sentBubble.locator(':scope > div').last().textContent();

        await chat.editMessage(sentBubble, editedText);

        const editedBubble = chat.getSentMessagesLocator().filter({ hasText: editedText }).first();
        await expect(chat.getEditedLabel(editedBubble)).toBeVisible();
        await expect(chat.getSentMessagesLocator().filter({ hasText: originalText })).toHaveCount(0);
        await expect(editedBubble.locator(':scope > div').last()).toHaveText(`Edited${timestampBefore}`);
        await expect(chat.getSentMessageByText(replyText)).toContainText(editedText);

        // The other user already has the conversation open - no reload.
        const receivedEdited = chat2.page.getByTestId('received-message').filter({ hasText: editedText }).first();
        await expect(receivedEdited).toBeVisible();
        await expect(chat2.getEditedLabel(receivedEdited)).toBeVisible();
        await expect(chat2.getReceivedMessageByText(replyText)).toContainText(editedText);
        await expect(chat2.page.getByTestId('received-message').filter({ hasText: originalText })).toHaveCount(0);

        // Stored, not only broadcast.
        await chat.page.reload();
        await (await chat.selectUser(secondUserShortName)).click();
        const reloadedBubble = chat.getSentMessagesLocator().filter({ hasText: editedText }).first();
        await expect(chat.getEditedLabel(reloadedBubble)).toBeVisible();
        await expect(chat.getSentMessageByText(replyText)).toContainText(editedText);
    });

    customTest('Edit is only offered on your own messages, and an empty edit cannot be saved', async ({ authPage, browser, loginData }) => {
        const incomingText = `not-yours-${Date.now()}`;
        const ownText = `cancel-edit-${Date.now()}`;
        await authPage.getLoginPage().navigateToLoginPage();
        const anotherLoginData = dataSet.find(user => user.username !== loginData.username);
        const firstUserShortName = loginData.username.split('@')[0];
        const secondUserShortName = anotherLoginData?.username.split('@')[0] || '';
        const chat = authPage.getChatPage();

        const pOManager2 = await authPage.getLoginPage().loginAnotherUser(browser, anotherLoginData!);
        await (await chat.selectUser(secondUserShortName)).click();
        await (await pOManager2.getChatPage().selectUser(firstUserShortName)).click();
        await pOManager2.getChatPage().sendMessage(incomingText);

        await expect(chat.getReceivedMessageByText(incomingText)).toBeVisible();
        await chat.openMessageActions(chat.getReceivedMessageByText(incomingText));
        await expect(chat.getMessageActionsMenu().getByRole('button', { name: 'Reply' })).toBeVisible();
        await expect(chat.getMessageActionsMenu().getByRole('button', { name: 'Edit' })).toHaveCount(0);
        await chat.page.keyboard.press('Escape');

        await chat.sendMessage(ownText);
        await chat.startEditingMessage(chat.getSentMessageByText(ownText));
        await chat.getEditMessageInput().fill('   ');
        await expect(chat.page.getByTestId('edit-message-save')).toBeDisabled();

        await chat.getEditMessageInput().press('Escape');
        await expect(chat.getEditMessageInput()).toHaveCount(0);
        const ownBubble = chat.getSentMessageByText(ownText);
        await expect(ownBubble).toBeVisible();
        await expect(chat.getEditedLabel(ownBubble)).toHaveCount(0);
    });
});
