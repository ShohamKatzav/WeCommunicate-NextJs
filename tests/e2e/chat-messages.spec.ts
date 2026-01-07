import { expect } from '@playwright/test';
import { customTest } from '../fixtures/test-base';
import dataSet from "../Data/usersTestData.json" with { type: "json" };

customTest.describe('Chat Messages Functionality', () => {

    customTest('Sending - Recieving - Deleting messages flow', async ({ authPage, browser, loginData }) => {
        const textToSend = 'Hello from user 1';
        await authPage.getLoginPage().navigateToLoginPage();
        const anotherLoginData = dataSet.find(user => user.username !== loginData.username);
        const firstUserShortName = loginData.username.split('@')[0];
        const secondUserShortName = anotherLoginData?.username.split('@')[0] || '';
        await (await authPage.getChatPage().selectUser(secondUserShortName)).click();
        const pOManager2 = await authPage.getLoginPage().loginAnotherUser(browser, anotherLoginData!);
        await authPage.getChatPage().messageInput.fill(textToSend);
        await authPage.getChatPage().sendMessageButton.click();
        await expect(authPage.getChatPage().pendingMessageIndicator).toHaveCount(0);
        await expect(pOManager2.getChatPage().getSenderDivAtConversationsBar(firstUserShortName)).toBeVisible();
        await (await pOManager2.getChatPage().selectUser(firstUserShortName)).click();
        const messageFromUser1 = await pOManager2.getChatPage().getMessageReceivedByText(textToSend);
        await expect(messageFromUser1).toBeVisible();
        await authPage.getChatPage().getMessageSentByText(textToSend).hover();
        await authPage.getChatPage().getDeleteButtonByMessageText(textToSend).click();

        // Confirm deletion in the dialog of both users
        await expect(authPage.getChatPage().lastMessageSent).toContainText('You deleted this message');
        await expect(pOManager2.getChatPage().lastMessageReceived).toContainText('This message was deleted');
    });

    customTest.describe('File sending test with no bypass header', () => {
        customTest.use({ extraHTTPHeaders: {} });
        customTest('Sending a message that includes a file flow', async ({ authPage, loginData }, testInfo) => {
            const fileName = 'WeCommunicate-Logo.png';
            const filePath = testInfo.config.rootDir + '/Data/' + fileName;
            await authPage.getLoginPage().navigateToLoginPage();
            const anotherLoginData = dataSet.find(user => user.username !== loginData.username);
            const secondUserShortName = anotherLoginData?.username.split('@')[0] || '';
            await (await authPage.getChatPage().selectUser(secondUserShortName)).click();
            await authPage.getChatPage().fileInput.setInputFiles(filePath);
            await expect(authPage.getChatPage().sendMessageButton).toBeEnabled({ timeout: 10000 });
            await authPage.getChatPage().sendMessageButton.click();
            await expect(authPage.getChatPage().pendingMessageIndicator).toHaveCount(0);
            await authPage.getForgotPasswordPage().page.waitForLoadState('networkidle');
            await expect(authPage.getChatPage().lastSentImage).toBeVisible();
            const baseName = fileName.split('.')[0];
            const srcRegex = new RegExp(baseName);
            await expect(authPage.getChatPage().lastSentImage).toHaveAttribute('src', srcRegex);
        });
    });

});

