import { expect } from '@playwright/test';
import { customTest } from '../fixtures/test-base';
import dataSet from "../Data/usersTestData.json" with { type: "json" };

customTest.describe('Typing indicator', () => {

    customTest('Clears when the typer closes their tab mid-sentence', async ({ authPage, browser, loginData }) => {
        await authPage.getLoginPage().navigateToLoginPage();
        const anotherLoginData = dataSet.find(user => user.username !== loginData.username);
        const firstUserShortName = loginData.username.split('@')[0];
        const secondUserShortName = anotherLoginData?.username.split('@')[0] || '';
        const chat = authPage.getChatPage();
        await chat.ensureConversation(secondUserShortName);

        const otherChat = (await authPage.getLoginPage().loginAnotherUser(browser, anotherLoginData!)).getChatPage();
        await (await otherChat.selectUser(firstUserShortName)).click();
        await otherChat.messageInput.pressSequentially('half a sentence', { delay: 50 });
        await expect(chat.typingIndicator).toBeVisible();

        // A closed tab never sends its own 'stop typing'. The server sends it
        // on disconnect, well inside the 8s the receiver would otherwise wait
        // before expiring the indicator (TYPING_EXPIRE_MS).
        await otherChat.page.context().close();
        await expect(chat.typingIndicator).toHaveCount(0, { timeout: 3000 });
    });

    customTest('Reaches a conversation reopened after deleting it', async ({ authPage, browser, loginData }) => {
        await authPage.getLoginPage().navigateToLoginPage();
        const anotherLoginData = dataSet.find(user => user.username !== loginData.username);
        const firstUserShortName = loginData.username.split('@')[0];
        const secondUserShortName = anotherLoginData?.username.split('@')[0] || '';
        const chat = authPage.getChatPage();
        await chat.ensureConversation(secondUserShortName);
        await chat.sendMessage(`before-delete-${Date.now()}`);

        // Deleting only hides the conversation from this user's list...
        await chat.dropDown.deleteConversation();
        await expect(chat.getConversationRow(secondUserShortName)).toHaveCount(0);
        // ...so reopening it from the people list finds nothing locally. It
        // must still join the real conversation, not an empty id-less chat.
        await chat.getUserRow(secondUserShortName).click();
        await expect(chat.conversationInfoDiv).toContainText(secondUserShortName, { ignoreCase: true });

        const otherChat = (await authPage.getLoginPage().loginAnotherUser(browser, anotherLoginData!)).getChatPage();
        await (await otherChat.selectUser(firstUserShortName)).click();

        await otherChat.messageInput.pressSequentially('typing into the reopened chat', { delay: 50 });
        await expect(chat.typingIndicator).toBeVisible();

        // And the other person's next message lands in the open chat live,
        // not only in the sidebar. (Sending also un-deletes the conversation,
        // which leaves the shared test data as it was.)
        const reply = `after-reopen-${Date.now()}`;
        await otherChat.messageInput.fill(reply);
        await otherChat.sendMessageButton.click();
        await expect(chat.getReceivedMessageByText(reply)).toBeVisible();

        await otherChat.page.context().close();
    });
});
