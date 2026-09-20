import { expect } from '@playwright/test';
import { customTest } from '../fixtures/test-base';
import dataSet from "../Data/usersTestData.json" with { type: "json" };

customTest.describe('PWA share target', () => {
    customTest.describe.configure({ timeout: 45_000 });

    customTest('Installed app advertises itself as a share target', async ({ authPage }) => {
        await authPage.getLoginPage().navigateToLoginPage();
        const response = await authPage.page.request.get('/manifest.json');
        expect(response.ok()).toBeTruthy();
        const manifest = await response.json();
        expect(manifest.share_target.action).toBe('/share-target');
        expect(manifest.share_target.method).toBe('POST');
        expect(manifest.share_target.enctype).toBe('multipart/form-data');
        expect(manifest.share_target.params.files[0].name).toBe('file');
    });

    customTest('Shared text opens the picker and lands in the composer', async ({ authPage, loginData }) => {
        const sharedTitle = `Shared article ${Date.now()}`;
        const sharedText = 'You have to read this';
        const sharedUrl = 'https://example.com/article';
        await authPage.getLoginPage().navigateToLoginPage();
        const anotherLoginData = dataSet.find(user => user.username !== loginData.username);
        const recipient = anotherLoginData?.username.split('@')[0] || '';
        const chat = authPage.getChatPage();

        await chat.shareContentViaShareTarget({
            title: sharedTitle,
            text: sharedText,
            url: sharedUrl
        });

        await expect(chat.shareToHeader).toBeVisible({ timeout: 10000 });
        await chat.conversationForm.participantLabel
            .filter({ hasText: recipient })
            .click();
        await chat.conversationForm.startChattingButton.click();

        await expect(chat.messageInput).toHaveValue(new RegExp(sharedTitle));
        await expect(chat.messageInput).toHaveValue(new RegExp(sharedText));
        await expect(chat.messageInput).toHaveValue(/example\.com\/article/);
    });

    customTest('Cancelling the share picker does not apply the shared text', async ({ authPage, loginData }) => {
        const sharedTitle = `Cancelled share ${Date.now()}`;
        await authPage.getLoginPage().navigateToLoginPage();
        const anotherLoginData = dataSet.find(user => user.username !== loginData.username);
        const recipient = anotherLoginData?.username.split('@')[0] || '';
        const chat = authPage.getChatPage();

        await chat.shareContentViaShareTarget({
            title: sharedTitle,
            text: 'Should not appear in the composer'
        });
        await expect(chat.shareToHeader).toBeVisible({ timeout: 10000 });
        await chat.page.getByRole('button', { name: 'Cancel' }).click();

        await chat.ensureConversation(recipient);
        await expect(chat.messageInput).not.toHaveValue(new RegExp(sharedTitle));
    });
});
