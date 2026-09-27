import { expect, Locator } from '@playwright/test';
import { customTest } from '../fixtures/test-base';
import POManager from '../page-objects/POManager';
import ChatPage from '../page-objects/ChatPage';
import dataSet from "../Data/usersTestData.json" with { type: "json" };

// Report a bug (app/components/bugReport/): the floating pill, the
// conversation ⋯ menu item that stands in for it on a phone, the contact
// page's card and the form.
// Under the e2e bypass header sendBugReport skips the rate limit and the
// email, so sending here never mails anyone.

const box = async (locator: Locator) => (await locator.boundingBox())!;

// Opened at desktop width, where the conversation list isn't a drawer.
async function openConversation(authPage: POManager, loginUsername: string) {
    const recipient = dataSet.find(user => user.username !== loginUsername)?.username.split('@')[0] || '';
    await authPage.getLoginPage().navigateToLoginPage();
    const chat = authPage.getChatPage();
    await chat.ensureConversation(recipient);
    return chat;
}

const conversationMenu = (chat: ChatPage) => chat.dropDown.dropdownButton.locator('..');

customTest.describe('Report a bug', () => {

    customTest('Desktop /chat keeps the floating pill, clear of the composer, and out of the ⋯ menu', async ({ authPage, loginData, page }) => {
        const chat = await openConversation(authPage, loginData.username);
        const pill = page.locator('.bug-report-fab');
        await expect(pill).toBeVisible();

        const pillBox = await box(pill);
        for (const other of [await box(chat.messageInput), await box(chat.sendMessageButton)]) {
            const apart = pillBox.y >= other.y + other.height || pillBox.y + pillBox.height <= other.y
                || pillBox.x >= other.x + other.width || pillBox.x + pillBox.width <= other.x;
            expect(apart).toBe(true);
        }

        // The pill is in view, so the menu doesn't repeat it.
        await chat.dropDown.dropdownButton.click();
        await expect(conversationMenu(chat).getByRole('button', { name: 'Disappearing Messages' })).toBeVisible();
        await expect(conversationMenu(chat).getByRole('button', { name: 'Report a bug', exact: true })).toBeHidden();
    });

    customTest('On a phone, an open conversation carries it in the ⋯ menu instead of floating over the thread', async ({ authPage, loginData, page }) => {
        const chat = await openConversation(authPage, loginData.username);
        await page.setViewportSize({ width: 390, height: 844 });

        // Nothing floats over the messages or the composer.
        await expect(page.locator('.bug-report-fab')).toBeHidden();

        await chat.dropDown.dropdownButton.click();
        const item = conversationMenu(chat).getByRole('button', { name: 'Report a bug', exact: true });
        await expect(item).toBeVisible();
        await item.click();

        // The same form, as a full-screen sheet, with the menu closed behind it.
        const dialog = page.getByRole('dialog', { name: 'Report a bug' });
        await expect(dialog).toBeVisible();
        await expect(dialog.getByLabel('What happened?')).toBeFocused();
        expect((await box(dialog)).width).toBe(390);
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();
        await expect(item).toBeHidden();
        await expect(chat.dropDown.dropdownButton).toBeFocused();
        await expect(page.locator('.bug-report-fab')).toBeHidden();

        // Another conversation's menu carries it too.
        await page.getByRole('button', { name: 'Open conversations' }).click();
        await page.locator('li').filter({ has: page.getByTestId('conversation-name') }).last().click();
        await expect(chat.messageInput).toBeVisible();
        await chat.dropDown.dropdownButton.click();
        await expect(item).toBeVisible();
    });

    customTest('On a phone, /chat with no conversation open keeps the pill in its corner', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/chat');
        await expect(page.getByRole('heading', { name: 'No conversation selected' })).toBeVisible();
        const pill = page.locator('.bug-report-fab');
        await expect(pill).toBeVisible();
        const pillBox = await box(pill);
        expect(pillBox.x + pillBox.width / 2).toBeGreaterThan(390 / 2);
        expect(844 - (pillBox.y + pillBox.height)).toBeGreaterThanOrEqual(20);
    });

    customTest('The pill can be hidden for the rest of the session', async ({ page, browser, baseURL }) => {
        await page.goto('/about', { waitUntil: 'networkidle' });
        const pill = page.locator('.bug-report-fab');
        await expect(pill.getByRole('button', { name: 'Report a bug', exact: true })).toBeVisible();

        await pill.getByRole('button', { name: 'Hide the Report a bug button' }).click();
        await expect(pill).toHaveCount(0);
        await expect(page.getByText('Report a bug is hidden for this visit.')).toBeVisible();

        // Still hidden on the next page and after a reload, in this session.
        await page.goto('/locations');
        await page.reload();
        await expect(page.getByRole('heading').first()).toBeVisible();
        await expect(pill).toHaveCount(0);

        // A new session (a fresh tab's sessionStorage) brings it back.
        const fresh = await browser.newContext({ ignoreHTTPSErrors: true, storageState: 'tests/state1.json', baseURL });
        const freshPage = await fresh.newPage();
        await freshPage.goto('/about');
        await expect(freshPage.locator('.bug-report-fab')).toBeVisible();
        await fresh.close();
    });

    customTest('/contact has only its own card button, and it sends a report', async ({ page }) => {
        // Settled first: a server action sent while UserProvider's own
        // mount-time action is still in flight can remount the page (and
        // close the form) - only reachable by filling it instantly.
        await page.goto('/contact', { waitUntil: 'networkidle' });
        const heading = page.getByRole('heading', { name: 'Something broke?' });
        await expect(heading).toBeVisible();
        await expect(page.locator('.bug-report-fab')).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Report a bug', exact: true })).toHaveCount(1);
        // That one button is the card's: in the same card as its heading and
        // text, which still sits above the email and phone cards.
        const card = page.locator('div.rounded-lg').filter({ has: heading });
        const openButton = card.getByRole('button', { name: 'Report a bug', exact: true });
        await expect(openButton).toBeVisible();
        await expect(card.getByText("If something in the app isn't working")).toBeVisible();
        expect((await box(card)).y).toBeLessThan((await box(page.getByRole('link', { name: 'Email shohamkatzav95@gmail.com' }))).y);

        await openButton.click();
        const dialog = page.getByRole('dialog', { name: 'Report a bug' });
        await dialog.getByRole('button', { name: 'Send report' }).click();
        await expect(dialog.getByRole('alert')).toHaveText('Please describe what happened in a few more words.');

        await dialog.getByLabel('What happened?').fill('e2e: the contact page report button sends a report.');
        await dialog.getByLabel(/What did you expect/).fill('A success message.');
        await dialog.getByRole('button', { name: 'Send report' }).click();
        await expect(dialog.getByRole('heading', { name: "Thanks, it's on its way!" })).toBeVisible();

        await dialog.getByRole('button', { name: 'Done' }).click();
        await expect(dialog).toBeHidden();
        await expect(openButton).toBeFocused();
        // A sent report doesn't come back when the form is opened again.
        await openButton.click();
        await expect(dialog.getByLabel('What happened?')).toHaveValue('');
    });

    customTest.describe('Right-to-left', () => {
        customTest.use({ viewport: { width: 390, height: 844 } });

        customTest('The pill sits in the left corner in Hebrew', async ({ page, context, baseURL }) => {
            await context.addCookies([{ name: 'locale', value: 'he', url: baseURL! }]);
            await page.goto('/about');
            const pill = page.getByRole('button', { name: 'דיווח על באג', exact: true });
            await expect(pill).toBeVisible();
            const pillBox = await box(pill);
            expect(pillBox.x + pillBox.width / 2).toBeLessThan(390 / 2);
            // Some air above the bottom edge, not stuck to it.
            expect(844 - (pillBox.y + pillBox.height)).toBeGreaterThanOrEqual(20);
        });
    });
});
