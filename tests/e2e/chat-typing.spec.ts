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

        // Closing the page like a user closing the tab (pagehide runs) sends
        // 'stop typing' right away. The allowance still covers the
        // receiver's own expiry (TYPING_EXPIRE_MS, 8s): on the live site the
        // socket disconnect can reach the server late (Render's proxy keeps
        // the connection open for a while), so the expiry is the guarantee
        // this checks - the indicator never sticks.
        await otherChat.page.close();
        await otherChat.page.context().close();
        await expect(chat.typingIndicator).toHaveCount(0, { timeout: 10_000 });
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
