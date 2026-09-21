import { expect } from '@playwright/test';
import { customTest } from '../fixtures/test-base';
import dataSet from "../Data/usersTestData.json" with { type: "json" };

// Coverage for the redesigned bottom prompt stack (see app/components/
// bottomPromptStack.tsx, promptBar.tsx and usePromptSlot.tsx). The push
// notification soft-ask is the only prompt reliably triggerable here:
// InstallPrompt depends on the browser firing `beforeinstallprompt`, which
// Chromium does not do under Playwright automation, so it has no e2e
// coverage of its own - these tests exercise the shared PromptBar/queue
// machinery through the one prompt that can actually be driven.
customTest.describe('Bottom prompts', () => {

    customTest('Push notification prompt is a single slim bar that never overlaps the composer', async ({ authPage, loginData }) => {
        const recipient = dataSet.find(user => user.username !== loginData.username)?.username.split('@')[0] || '';

        await authPage.getLoginPage().navigateToLoginPage();
        const chat = authPage.getChatPage();
        await chat.resetNotificationPermissionToPrompt();
        await chat.ensureConversation(recipient);

        await expect(chat.notificationsPromptMessage).toBeVisible();
        const stackBox = await chat.bottomPromptStack.boundingBox();
        const composerBox = await chat.sendMessageButton.boundingBox();
        expect(stackBox).not.toBeNull();
        expect(composerBox).not.toBeNull();

        // The bar sits below the composer, not over it - disjoint rectangles.
        expect(stackBox!.y).toBeGreaterThanOrEqual(composerBox!.y + composerBox!.height - 1);
        // A single slim row, not the old stacked max-w-md cards.
        expect(stackBox!.height).toBeLessThan(100);
    });

    customTest('Dismissing the prompt persists across reload', async ({ authPage }) => {
        await authPage.getLoginPage().navigateToLoginPage();
        const chat = authPage.getChatPage();
        await chat.resetNotificationPermissionToPrompt();

        await expect(chat.notificationsPromptMessage).toBeVisible();
        await chat.dismissNotificationsButton.click();
        await expect(chat.notificationsPromptMessage).toHaveCount(0);

        await chat.page.reload();
        await expect(chat.notificationsPromptMessage).toHaveCount(0);
    });

    customTest('Later snoozes the prompt instead of dismissing it permanently', async ({ authPage }) => {
        await authPage.getLoginPage().navigateToLoginPage();
        const chat = authPage.getChatPage();
        await chat.resetNotificationPermissionToPrompt();

        await expect(chat.notificationsPromptMessage).toBeVisible();
        await chat.laterNotificationsButton.click();
        await expect(chat.notificationsPromptMessage).toHaveCount(0);

        const dismissed = await chat.page.evaluate(() => localStorage.getItem('bp:dismissed:push-soft-ask'));
        const snoozedUntil = Number(await chat.page.evaluate(() => localStorage.getItem('bp:snoozedUntil:push-soft-ask')));
        expect(dismissed).toBeNull();
        expect(snoozedUntil).toBeGreaterThan(Date.now());

        // Fast-forward past the snooze instead of waiting 24h for real.
        await chat.page.evaluate(() => localStorage.setItem('bp:snoozedUntil:push-soft-ask', String(Date.now() - 1000)));
        await chat.page.reload();
        await expect(chat.notificationsPromptMessage).toBeVisible();
    });

    // A real subscription can't be driven end-to-end here: Chromium refuses
    // the Push API in the incognito-style contexts Playwright always runs in
    // ("Chrome currently does not support the Push API in incognito mode"),
    // so subscribeToPush() always takes its catch branch under automation.
    // Granting notifications first would also hide the soft-ask (permission
    // would no longer be "default"), so Enable is clicked from the prompt
    // state instead. That still covers what this test cares about - Enable
    // never leaves the old persistent green "Notifications Enabled" banner
    // behind, because both success and failure are one-shot toasts now.
    customTest('Enabling notifications never leaves a persistent banner behind', async ({ authPage }) => {
        await authPage.getLoginPage().navigateToLoginPage();
        const chat = authPage.getChatPage();
        await chat.resetNotificationPermissionToPrompt();

        await expect(chat.notificationsPromptMessage).toBeVisible();
        await chat.enableNotificationsButton.click();

        await expect(chat.toastWarnings.notificationsEnableFailedToast).toBeVisible();
        await expect(chat.notificationsPromptMessage).toHaveCount(0);
        await expect(chat.page.getByText('Notifications Enabled')).toHaveCount(0);
    });
});
