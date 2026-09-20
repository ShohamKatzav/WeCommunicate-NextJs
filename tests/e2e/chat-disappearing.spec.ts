import { expect } from '@playwright/test';
import { customTest } from '../fixtures/test-base';
import dataSet from "../Data/usersTestData.json" with { type: "json" };

customTest.describe('Self-destructing messages', () => {
    customTest.describe.configure({ timeout: 45_000 });

    customTest.afterEach(async ({ authPage }) => {
        const chat = authPage.getChatPage();
        try {
            if (await chat.dropDown.dropdownButton.isVisible()) {
                await chat.dropDown.setDisappearingDuration('Off');
            }
        } catch {
            // Best-effort: later chat-serial tests should not inherit a TTL.
        }
    });

    customTest('Per-conversation duration can be saved and is not instant deletion', async ({ authPage, loginData }) => {
        const messageText = `ttl-still-visible-${Date.now()}`;
        await authPage.getLoginPage().navigateToLoginPage();
        const anotherLoginData = dataSet.find(user => user.username !== loginData.username);
        const recipient = anotherLoginData?.username.split('@')[0] || '';
        const chat = authPage.getChatPage();
        await chat.ensureConversation(recipient);

        await chat.dropDown.openDisappearingMessages();
        await expect(chat.dropDown.getDisappearingDurationOption('Off')).toBeVisible();
        await expect(chat.dropDown.getDisappearingDurationOption('24 hours')).toBeVisible();
        await expect(chat.dropDown.getDisappearingDurationOption('7 days')).toBeVisible();

        await chat.dropDown.setDisappearingDuration('24 hours');
        await expect(chat.page.getByText('New messages in this chat will disappear automatically')).toBeVisible();

        await chat.dropDown.openDisappearingMessages();
        await expect(chat.dropDown.getDisappearingDurationOption('24 hours')).toBeEnabled({ timeout: 10000 });
        await expect(chat.dropDown.getDisappearingDurationOption('24 hours')).toBeChecked();
        await chat.page.getByRole('button', { name: 'Cancel' }).click();
        await expect(chat.dropDown.disappearingMessagesHeading).toBeHidden();

        await chat.sendMessage(messageText);
        await expect(chat.getSentMessageByText(messageText)).toBeVisible();

        await chat.dropDown.setDisappearingDuration('Off');
        await expect(chat.page.getByText('Disappearing messages turned off')).toBeVisible();
        await expect(chat.getSentMessageByText(messageText)).toBeVisible();
    });
});
