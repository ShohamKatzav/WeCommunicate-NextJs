import { randomUUID } from 'crypto';
import { APIRequestContext, expect } from '@playwright/test';
import { customTest } from '../fixtures/test-base';
import dataSet from "../Data/usersTestData.json" with { type: "json" };
import { getPushRegistrations, removePushEndpoint } from '../utils/pushSubscriptions';
import { SESSION_MAX_AGE_SECONDS } from '../../app/config/session';
import ChatPage from '../page-objects/ChatPage';

const SYNC_TIMEOUT_MS = 15000;

customTest.describe('Push subscription lifecycle', () => {
    // .invalid never resolves, so a push some other test triggers for these
    // users while the row exists fails fast instead of going anywhere.
    let endpoint: string;
    const registeredEmails = (request: APIRequestContext) => async () =>
        (await getPushRegistrations(request, endpoint)).map(registration => registration.email);

    async function enableNotifications(chat: ChatPage): Promise<void> {
        await expect(chat.notificationsPromptMessage).toBeVisible();
        await chat.enableNotificationsButton.click();
        await expect(chat.toastWarnings.notificationsEnabledToast).toBeVisible();
    }

    customTest.beforeEach(async ({ authPage }) => {
        endpoint = `https://push.invalid/e2e/${randomUUID()}`;
        await authPage.getChatPage().stubGrantedPush(endpoint);
    });

    customTest.afterEach(async ({ request }) => {
        await removePushEndpoint(request, endpoint);
    });

    customTest('Logging out removes this device\'s push subscription', async ({ authPage, request, loginData }) => {
        const chat = authPage.getChatPage();
        await chat.page.goto('/chat');
        await enableNotifications(chat);
        await expect.poll(registeredEmails(request), { timeout: SYNC_TIMEOUT_MS }).toEqual([loginData.username]);

        // A device's registration may not outlive the session that made it.
        const [registration] = await getPushRegistrations(request, endpoint);
        const expiresAt = new Date(registration.expiresAt).getTime();
        expect(expiresAt).toBeGreaterThan(Date.now());
        expect(expiresAt).toBeLessThanOrEqual(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

        await chat.navbar.logout();
        await expect.poll(registeredEmails(request), { timeout: SYNC_TIMEOUT_MS }).toEqual([]);
        await expect.poll(() => chat.hasPushSubscription(), { timeout: SYNC_TIMEOUT_MS }).toBe(false);
    });

    customTest('A subscription stays registered across reloads', async ({ authPage, request, loginData }) => {
        const chat = authPage.getChatPage();
        await chat.page.goto('/chat');
        await enableNotifications(chat);
        await expect.poll(registeredEmails(request), { timeout: SYNC_TIMEOUT_MS }).toEqual([loginData.username]);

        await chat.page.reload();
        await expect(chat.enableNotificationsButton).toHaveCount(0);
        expect(await registeredEmails(request)()).toEqual([loginData.username]);
        expect(await chat.hasPushSubscription()).toBe(true);
    });

    customTest('The same account logging back in is resubscribed without being asked', async ({ authPage, request, loginData }) => {
        const chat = authPage.getChatPage();
        await chat.page.goto('/chat');
        await enableNotifications(chat);
        await expect.poll(registeredEmails(request), { timeout: SYNC_TIMEOUT_MS }).toEqual([loginData.username]);

        await chat.navbar.logout();
        await expect.poll(registeredEmails(request), { timeout: SYNC_TIMEOUT_MS }).toEqual([]);

        await authPage.getLoginPage().loginByData(loginData);
        await expect.poll(registeredEmails(request), { timeout: SYNC_TIMEOUT_MS }).toEqual([loginData.username]);
        await expect(chat.enableNotificationsButton).toHaveCount(0);
    });

    // Notification permission is the browser's and survives the logout, but
    // a different account still has to opt in - no browser prompt this time.
    customTest('The next user to log in on the device is asked before being subscribed', async ({ authPage, request, loginData }) => {
        const nextUser = dataSet.find(user => user.username !== loginData.username)!;
        const chat = authPage.getChatPage();
        await chat.page.goto('/chat');
        await enableNotifications(chat);
        await expect.poll(registeredEmails(request), { timeout: SYNC_TIMEOUT_MS }).toEqual([loginData.username]);

        await chat.navbar.logout();
        await expect.poll(registeredEmails(request), { timeout: SYNC_TIMEOUT_MS }).toEqual([]);

        await authPage.getLoginPage().loginByData(nextUser);
        await expect(chat.notificationsPromptMessage).toBeVisible();
        expect(await registeredEmails(request)()).toEqual([]);

        await enableNotifications(chat);
        await expect.poll(registeredEmails(request), { timeout: SYNC_TIMEOUT_MS }).toEqual([nextUser.username]);
    });

    // Same device state an expired session leaves behind: the browser still
    // holds the subscription and the server still has the old user's row.
    customTest('A session that ended without logging out stops notifying its user once someone else logs in', async ({ authPage, request, loginData, context }) => {
        const nextUser = dataSet.find(user => user.username !== loginData.username)!;
        const chat = authPage.getChatPage();
        await chat.page.goto('/chat');
        await enableNotifications(chat);
        await expect.poll(registeredEmails(request), { timeout: SYNC_TIMEOUT_MS }).toEqual([loginData.username]);

        await context.clearCookies();
        await authPage.getLoginPage().navigateToLoginPage();
        await authPage.getLoginPage().loginByData(nextUser);
        await expect.poll(registeredEmails(request), { timeout: SYNC_TIMEOUT_MS }).toEqual([]);
        await expect(chat.notificationsPromptMessage).toBeVisible();
        expect(await chat.hasPushSubscription()).toBe(false);
    });
});
