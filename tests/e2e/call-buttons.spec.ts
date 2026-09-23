import { expect } from '@playwright/test';
import { customTest } from '../fixtures/test-base';
import dataSet from "../Data/usersTestData.json" with { type: "json" };

// Only checks where the call buttons appear - no camera or microphone is
// granted here, and a real WebRTC call is covered by the manual test pass,
// not e2e (fake media plus two browsers is too flaky to gate on).
customTest.describe('Call buttons', () => {
    customTest.beforeEach(async ({ authPage }) => {
        await authPage.getLoginPage().navigateToLoginPage();
    });

    customTest('A 1:1 conversation offers voice and video calls', async ({ authPage, loginData }) => {
        const chat = authPage.getChatPage();
        const otherUser = dataSet.find(user => user.username !== loginData.username)!.username.split('@')[0];
        await chat.ensureConversation(otherUser);

        await expect(chat.startVoiceCallButton).toBeVisible();
        await expect(chat.startVideoCallButton).toBeVisible();
    });

    customTest('A group conversation offers no calls', async ({ authPage }) => {
        const chat = authPage.getChatPage();
        await chat.groupChatButton.click();
        await chat.conversationForm.participantLabel.first().click();
        await chat.conversationForm.participantLabel.nth(1).click();
        await chat.conversationForm.createGroupButton.click();
        await expect(chat.conversationInfoDiv).toContainText('members online');

        await expect(chat.startVoiceCallButton).toHaveCount(0);
        await expect(chat.startVideoCallButton).toHaveCount(0);
    });
});
