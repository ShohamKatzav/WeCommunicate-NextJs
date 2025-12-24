import { expect } from '@playwright/test';
import { customTest } from '../fixtures/test-base';
import dataSet from "../Data/usersTestData.json" with { type: "json" };

customTest.describe.configure({ mode: 'serial' });

customTest.describe('Presence Functionality', () => {

    customTest('Online users indicator test', async ({ authPage, browser, loginData }) => {
        await authPage.getLoginPage().navigateToLoginPage();
        // Ensure all network requests (include socket.io for the online users indicator) are done
        await authPage.page.waitForLoadState('networkidle');
        let onlineCountBeforeSecondUserConnection = await authPage.getChatPage().getOnlineUsersCount();
        const anotherLoginData = dataSet.find(user => user.username !== loginData.username);
        const pOManager2 = await authPage.getLoginPage().loginAnotherUser(browser, anotherLoginData!);
        await expect(authPage.getChatPage().onlineUsersCount).toHaveCount(onlineCountBeforeSecondUserConnection + 1);
        await pOManager2.getChatPage().navbar.logout();
        await expect(pOManager2.getLoginPage().loginHeader).toBeVisible();
        await expect(authPage.getChatPage().onlineUsersCount).toHaveCount(onlineCountBeforeSecondUserConnection);

    });
});