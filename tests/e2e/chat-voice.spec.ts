import { expect } from '@playwright/test';
import { customTest } from '../fixtures/test-base';
import dataSet from "../Data/usersTestData.json" with { type: "json" };

customTest.describe('Voice messages', () => {
    customTest.describe.configure({ timeout: 45_000 });

    customTest('Record button appears with a conversation and is gone after leaving', async ({ authPage, loginData }) => {
        await authPage.getLoginPage().navigateToLoginPage();
        const anotherLoginData = dataSet.find(user => user.username !== loginData.username);
        const recipient = anotherLoginData?.username.split('@')[0] || '';
        const chat = authPage.getChatPage();

        await expect(chat.recordVoiceButton).toHaveCount(0);
        await chat.ensureConversation(recipient);
        await expect(chat.recordVoiceButton).toBeVisible();
        await expect(chat.recordVoiceButton).toBeEnabled();

        await chat.leaveChatRoom();
        await expect(chat.recordVoiceButton).toHaveCount(0);
    });

    customTest('Recording can be cancelled without sending', async ({ authPage, loginData }) => {
        await authPage.getLoginPage().navigateToLoginPage();
        const anotherLoginData = dataSet.find(user => user.username !== loginData.username);
        const recipient = anotherLoginData?.username.split('@')[0] || '';
        const chat = authPage.getChatPage();

        await chat.ensureConversation(recipient);
        await chat.recordVoiceButton.click();
        await expect(chat.sendVoiceMessageButton).toBeVisible();
        await expect(chat.cancelVoiceButton).toBeVisible();
        await expect(chat.page.getByText(/\/ 1:00/)).toBeVisible();
        await expect(chat.messageInput).toHaveCount(0);

        await chat.cancelVoiceButton.click();
        await expect(chat.recordVoiceButton).toBeVisible();
        await expect(chat.messageInput).toBeVisible();
        await expect(chat.lastSentAudio).toHaveCount(0);
    });

    customTest.describe('Voice upload with no bypass header', () => {
        customTest.use({ extraHTTPHeaders: {} });

        customTest('Hold-to-record send appears as an audio message', async ({ authPage, loginData }) => {
            // Vercel Blob client uploads need a public HTTPS origin. Localhost
            // is rejected; this runs in CI against Render, or locally via ngrok.
            customTest.skip(!process.env.CI, 'Vercel Blob uploads need a public HTTPS origin (CI or ngrok)');

            await authPage.getLoginPage().navigateToLoginPage();
            const anotherLoginData = dataSet.find(user => user.username !== loginData.username);
            const recipient = anotherLoginData?.username.split('@')[0] || '';
            const chat = authPage.getChatPage();

            await chat.ensureConversation(recipient);
            const sentAudio = chat.page.getByTestId('sent-message').locator('audio');
            const audioCountBefore = await sentAudio.count();
            await chat.recordVoiceButton.click();
            await expect(chat.sendVoiceMessageButton).toBeVisible();
            await expect(chat.page.getByText('0:01 / 1:00')).toBeVisible({ timeout: 4000 });
            await chat.sendVoiceMessageButton.click();
            await expect(chat.page.getByText('Sending voice message...')).toBeVisible();
            await expect(chat.recordVoiceButton).toBeVisible({ timeout: 20000 });
            await expect(chat.pendingMessageIndicator).toHaveCount(0, { timeout: 15000 });
            await expect(sentAudio).toHaveCount(audioCountBefore + 1, { timeout: 10000 });
        });
    });
});
