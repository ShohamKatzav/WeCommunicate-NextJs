import { expect } from '@playwright/test';
import { customTest } from '../fixtures/test-base';
import dataSet from "../Data/usersTestData.json" with { type: "json" };

customTest.describe.configure({ mode: 'serial' });

customTest.describe('Chat Notifications Functionality', () => {

    customTest('Notification received while not in chat room', async ({ authPage, browser, loginData }) => {
        const firstTextToSend = 'First message from user 1';
        const secondTextToSend = 'Second message from user 1';

        await authPage.getLoginPage().navigateToLoginPage();
        const anotherLoginData = dataSet.find(user => user.username !== loginData.username);
        const firstUserShortName = loginData.username.split('@')[0];
        const secondUserShortName = anotherLoginData?.username.split('@')[0] || '';
        await (await authPage.getChatPage().getUserFromListByUsername(secondUserShortName)).click();

        // Login as user 2 and clean notifications by entering chat room
        const pOManager2 = await authPage.getLoginPage().loginAnotherUser(browser, anotherLoginData!);
        await (await pOManager2.getChatPage().getUserFromListByUsername(firstUserShortName)).click();
        await pOManager2.getChatPage().leaveChatRoom();

        await authPage.getChatPage().messageInput.fill(firstTextToSend);
        await authPage.getChatPage().sendMessageButton.click();
        await authPage.getChatPage().messageInput.fill(secondTextToSend);
        await authPage.getChatPage().sendMessageButton.click();

        await expect(authPage.getChatPage().pendingMessageIndicator).toHaveCount(0);
        await pOManager2.getChatPage().waitForNotificationCount(firstUserShortName, 2);

    });

    customTest('Notification received while not online', async ({ authPage, browser, loginData }) => {
        const firstTextToSend = 'First message from user 1';
        const secondTextToSend = 'Second message from user 1';

        await authPage.getLoginPage().navigateToLoginPage();
        const anotherLoginData = dataSet.find(user => user.username !== loginData.username);
        const firstUserShortName = loginData.username.split('@')[0];
        const secondUserShortName = anotherLoginData?.username.split('@')[0] || '';
        await (await authPage.getChatPage().getUserFromListByUsername(secondUserShortName)).click();

        // Login as user 2 and clean notifications by entering chat room
        let pOManager2 = await authPage.getLoginPage().loginAnotherUser(browser, anotherLoginData!);
        await (await pOManager2.getChatPage().getUserFromListByUsername(firstUserShortName)).click();

        // Logout
        await pOManager2.getChatPage().leaveChatRoom();
        await pOManager2.getChatPage().navbar.logout();
        await expect(pOManager2.getLoginPage().loginHeader).toBeVisible();

        // Send messages while user 2 is offline
        await authPage.getChatPage().messageInput.fill(firstTextToSend);
        await authPage.getChatPage().sendMessageButton.click();
        await authPage.getChatPage().messageInput.fill(secondTextToSend);
        await authPage.getChatPage().sendMessageButton.click();
        await expect(authPage.getChatPage().pendingMessageIndicator).toHaveCount(0);

        await pOManager2.getLoginPage().loginByData(anotherLoginData!);
        await pOManager2.getChatPage().waitForNotificationCount(firstUserShortName, 2, 15000);

    });


});

