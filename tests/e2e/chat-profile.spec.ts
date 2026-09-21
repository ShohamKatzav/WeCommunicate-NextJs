import { expect } from '@playwright/test';
import { customTest } from '../fixtures/test-base';
import dataSet from "../Data/usersTestData.json" with { type: "json" };

// The shared test account has no `nickname` field of its own - other specs
// depend on that absence, since the navbar/chat UI falls back to a
// capitalized AsShortName(email) (see app/utils/stringFormat.tsx) whenever
// nickname is unset. There's no "clear nickname" control in the edit UI
// (Save requires a non-empty value, matching sign-up), so cleanup restores
// this exact fallback string rather than the account's real original state.
const FALLBACK_NICKNAME = 'Shoham';

customTest.describe('Profile editing', () => {
    customTest.describe.configure({ timeout: 45_000 });

    // "About" and accent color are read by no other spec, but leaving them
    // set would still be a leftover side effect of this test - about is
    // clearable (empty unsets it server-side, see profileActions.ts), so
    // restore both to how an untouched profile looks.
    customTest.afterEach(async ({ authPage }) => {
        try {
            const profilePage = authPage.getProfilePage();
            await profilePage.navigateToEditViaNavbar();
            await profilePage.nicknameInput.fill(FALLBACK_NICKNAME);
            await profilePage.aboutInput.fill('');
            await profilePage.setAccentColor('#15803d');
            await profilePage.save();
        } catch {
            // best-effort cleanup
        }
    });

    customTest('Editing nickname, about, and accent color updates the profile and own message bubble', async ({ authPage, loginData }) => {
        await authPage.getLoginPage().navigateToLoginPage();
        const chat = authPage.getChatPage();
        const profilePage = authPage.getProfilePage();

        const otherUser = dataSet.find(user => user.username !== loginData.username);
        const recipient = otherUser?.username.split('@')[0] || '';

        const newNickname = `Profile${Date.now()}`.slice(0, 40);
        const newAbout = `Testing at ${Date.now()}`;
        const accentColorHex = '#1d4ed8';
        const accentColorRgb = 'rgb(29, 78, 216)';

        await profilePage.navigateToEditViaNavbar();

        await profilePage.nicknameInput.fill(newNickname);
        await profilePage.aboutInput.fill(newAbout);
        await profilePage.setAccentColor(accentColorHex);
        await profilePage.save();

        await expect(profilePage.nicknameHeading).toHaveText(newNickname);
        await expect(profilePage.aboutText).toHaveText(newAbout);
        await expect(profilePage.accentSwatch).toHaveCSS('background-color', accentColorRgb);

        await chat.navigateToChatPage();
        await chat.ensureConversation(recipient);

        const messageText = `accent-check-${Date.now()}`;
        await chat.sendMessage(messageText);
        await expect(chat.getSentMessageByText(messageText)).toHaveCSS('background-color', accentColorRgb);
    });

    // Regression test: navbar links used to be bare relative paths (e.g.
    // href="chat"), which the browser resolves against the *current* path.
    // That was invisible while every route was one segment deep, but breaks
    // as soon as a two-segment route like /profile/edit exists - clicking
    // "chat" from there used to land on /profile/chat instead of /chat.
    customTest('Navbar links resolve correctly from a nested profile route', async ({ authPage }) => {
        await authPage.getLoginPage().navigateToLoginPage();
        const profilePage = authPage.getProfilePage();

        await profilePage.navigateToEditViaNavbar();
        await expect(authPage.page).toHaveURL(/\/profile\/edit$/);

        await Promise.all([
            authPage.page.waitForURL('**/chat'),
            profilePage.navbar.chatLink.click(),
        ]);
        expect(new URL(authPage.page.url()).pathname).toBe('/chat');
    });
});

customTest.describe('Phone number editing', () => {
    customTest.describe.configure({ timeout: 45_000 });

    // Unlike nickname/about/accent above, no other spec reads or depends on
    // shoham@gmail.com's `phone` field being unset, and setting it to the
    // same fixed number on every run is idempotent (no unique-index
    // conflict) - so this deliberately has no cleanup step.

    // Bypasses real OTP verification the same way tests/e2e/otp-processes.spec.ts
    // does for password reset - an 'e2e' cookie plus the fixed code '000000'
    // (see verifyOTP in app/lib/OTPActions.ts), gated on E2E_TEST so it can't
    // do anything outside a test run. The account still needs a real email on
    // file for the phone-editor to be enabled at all - shoham@gmail.com has one.
    customTest.beforeEach(async ({ context, baseURL }) => {
        const domain = new URL(baseURL || 'https://localhost:3000').hostname;
        await context.addCookies([
            {
                name: 'e2e',
                value: process.env.TEST_BYPASS_KEY || 'development_secret',
                domain,
                path: '/',
                httpOnly: true,
            },
        ]);
    });

    customTest('Rejects an invalid phone number before sending a code', async ({ authPage }) => {
        await authPage.getLoginPage().navigateToLoginPage();
        const profilePage = authPage.getProfilePage();

        await profilePage.navigateToEditViaNavbar();
        await profilePage.phoneAddOrChangeButton.click();
        await profilePage.newPhoneInput.fill('12345');
        await profilePage.sendPhoneCodeButton.click();

        await expect(authPage.page.getByText('Use an international phone number')).toBeVisible();
        // Still on the "enter phone" step - an invalid number never reaches
        // the OTP step.
        await expect(profilePage.phoneOtpInput).toHaveCount(0);
    });

    customTest('Adding a phone number requires an emailed verification code', async ({ authPage }) => {
        await authPage.getLoginPage().navigateToLoginPage();
        const profilePage = authPage.getProfilePage();
        const newPhone = '+15550001111';

        await profilePage.navigateToEditViaNavbar();
        await profilePage.phoneAddOrChangeButton.click();
        await profilePage.newPhoneInput.fill(newPhone);
        await profilePage.sendPhoneCodeButton.click();

        await expect(profilePage.phoneOtpInput).toBeVisible();
        await profilePage.phoneOtpInput.fill('000000');
        await profilePage.confirmPhoneButton.click();

        await expect(authPage.page.getByText(newPhone, { exact: true })).toBeVisible();
        await expect(profilePage.phoneOtpInput).toHaveCount(0);
    });
});
