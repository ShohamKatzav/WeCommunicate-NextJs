import { expect } from '@playwright/test';
import { customTest } from '../fixtures/test-base';
import dataSet from "../Data/usersTestData.json" with { type: "json" };
import TESTS_DATA from "../Data/scenariosData.json" with { type: "json" };
import globalTeardown from '../utils/global.teardown'


customTest.describe('Chat Notifications Functionality', () => {

    customTest.beforeEach(async () => {
        await globalTeardown();
    });

    customTest('@Notifications received while not in chat room', async ({ authPage, browser, loginData }) => {
        const firstTextToSend = 'First message from user 1';
        const secondTextToSend = 'Second message from user 1';

        await authPage.getLoginPage().navigateToLoginPage();
        const anotherLoginData = dataSet.find(user => user.username !== loginData.username);
        const firstUserShortName = loginData.username.split('@')[0];
        const secondUserShortName = anotherLoginData?.username.split('@')[0] || '';
        await (await authPage.getChatPage().selectUser(secondUserShortName)).click();

        // Login as user 2 and clean notifications by entering chat room
        const pOManager2 = await authPage.getLoginPage().loginAnotherUser(browser, anotherLoginData!);

        await authPage.getChatPage().messageInput.fill(firstTextToSend);
        await authPage.getChatPage().sendMessageButton.click();
        await authPage.getChatPage().messageInput.fill(secondTextToSend);
        await authPage.getChatPage().sendMessageButton.click();

        await expect(authPage.getChatPage().pendingMessageIndicator).toHaveCount(0);
        await pOManager2.getChatPage().waitForNotificationCount(firstUserShortName, 2);

    });


    customTest.describe('Offline notification test', () => {
        customTest.use({ storageState: 'tests/state3.json' });
        customTest('@Notifications received while not online', async ({ authPage, browser }) => {
            const ExtractedTestData = TESTS_DATA.OFFLINE_NOTIFICATIONS_TEST;

            await authPage.getLoginPage().navigateToLoginPage();
            const anotherLoginData = { username: ExtractedTestData.recipient, password: '12345678' };
            const firstUserShortName = ExtractedTestData.sender.split('@')[0];
            const secondUserShortName = anotherLoginData?.username.split('@')[0] || '';
            await (await authPage.getChatPage().selectUser(secondUserShortName)).click();

            // Send messages while user 2 is offline. Each save has to finish
            // before the next one is sent: on CI the two clocks share the
            // default 5s expect budget, and the second save is often still
            // in flight when that budget runs out (the retry then passes).
            await authPage.getChatPage().sendMessage(ExtractedTestData.test_messages[0]);
            await authPage.getChatPage().sendMessage(ExtractedTestData.test_messages[1]);

            let pOManager2 = await authPage.getLoginPage().loginAnotherUser(browser, anotherLoginData!);
            await pOManager2.getChatPage().waitForNotificationCount(firstUserShortName, 2);

        });
    });

});

