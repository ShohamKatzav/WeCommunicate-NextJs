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
        await authPage.getChatPage().openMessageActions(authPage.getChatPage().getMessageSentByText(textToSend));
        await authPage.getChatPage().getMessageActionsDeleteButton().click();

        // Confirm deletion in the dialog of both users
        await expect(authPage.getChatPage().getSentMessageByText('You deleted this message')).toBeVisible();
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

        customTest('Large photos are compressed client-side before upload', async ({ authPage, loginData }) => {
            // Vercel Blob client uploads need a public HTTPS origin. Localhost
            // is rejected; this runs in CI against Render, or locally via ngrok.
            customTest.skip(!process.env.CI, 'Vercel Blob uploads need a public HTTPS origin (CI or ngrok)');

            await authPage.getLoginPage().navigateToLoginPage();
            const anotherLoginData = dataSet.find(user => user.username !== loginData.username);
            const secondUserShortName = anotherLoginData?.username.split('@')[0] || '';
            await (await authPage.getChatPage().selectUser(secondUserShortName)).click();

            await authPage.getChatPage().attachGeneratedJpeg();
            await expect(authPage.getChatPage().sendMessageButton).toBeEnabled({ timeout: 15000 });
            await authPage.getChatPage().sendMessageButton.click();
            await expect(authPage.getChatPage().pendingMessageIndicator).toHaveCount(0);
            await expect(authPage.getChatPage().lastSentImage).toBeVisible();
        });
    });

});

customTest.describe('Message link rendering', () => {

    customTest('A URL in message text renders as a real, safe link', async ({ authPage, loginData }) => {
        const sharedUrl = 'https://example.com/path?x=1';
        const textToSend = `Check this out: ${sharedUrl} thanks`;
        await authPage.getLoginPage().navigateToLoginPage();
        const anotherLoginData = dataSet.find(user => user.username !== loginData.username);
        const secondUserShortName = anotherLoginData?.username.split('@')[0] || '';
        await (await authPage.getChatPage().selectUser(secondUserShortName)).click();

        await authPage.getChatPage().sendMessage(textToSend);

        const sentMessage = authPage.getChatPage().getSentMessageByText('Check this out');
        const link = sentMessage.getByRole('link', { name: sharedUrl });
        await expect(link).toBeVisible();
        await expect(link).toHaveAttribute('href', sharedUrl);
        await expect(link).toHaveAttribute('target', '_blank');
        await expect(link).toHaveAttribute('rel', /noopener/);
    });

    customTest('Plain text with no URL is not linkified', async ({ authPage, loginData }) => {
        const textToSend = `Just a normal message, nothing to click ${Date.now()}`;
        await authPage.getLoginPage().navigateToLoginPage();
        const anotherLoginData = dataSet.find(user => user.username !== loginData.username);
        const secondUserShortName = anotherLoginData?.username.split('@')[0] || '';
        await (await authPage.getChatPage().selectUser(secondUserShortName)).click();

        await authPage.getChatPage().sendMessage(textToSend);

        const sentMessage = authPage.getChatPage().getSentMessageByText(textToSend);
        await expect(sentMessage.getByRole('link')).toHaveCount(0);
    });

    customTest('A javascript: URL in message text is never turned into a link', async ({ authPage, loginData }) => {
        const textToSend = `click javascript:alert(1) nope ${Date.now()}`;
        await authPage.getLoginPage().navigateToLoginPage();
        const anotherLoginData = dataSet.find(user => user.username !== loginData.username);
        const secondUserShortName = anotherLoginData?.username.split('@')[0] || '';
        await (await authPage.getChatPage().selectUser(secondUserShortName)).click();

        await authPage.getChatPage().sendMessage(textToSend);

        const sentMessage = authPage.getChatPage().getSentMessageByText('click javascript');
        await expect(sentMessage.getByRole('link')).toHaveCount(0);
    });
});

