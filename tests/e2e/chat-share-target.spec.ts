import { expect } from '@playwright/test';
import { customTest } from '../fixtures/test-base';
import dataSet from "../Data/usersTestData.json" with { type: "json" };
import TESTS_DATA from "../Data/scenariosData.json" with { type: "json" };

customTest.describe('PWA share target', () => {
    customTest.describe.configure({ timeout: 45_000 });

    customTest('Installed app advertises itself as a share target', async ({ authPage }) => {
        await authPage.getLoginPage().navigateToLoginPage();
        const response = await authPage.page.request.get('/manifest.json');
        expect(response.ok()).toBeTruthy();
        expect(response.headers()['content-type']).toMatch(/manifest\+json|application\/json/);
        const manifest = await response.json();
        expect(manifest.share_target.action).toBe('/share-target');
        expect(manifest.share_target.method).toBe('POST');
        expect(manifest.share_target.enctype).toBe('multipart/form-data');
        expect(manifest.share_target.params.files[0].name).toBe('file');
        expect(
            (manifest.share_target.params.files[0].accept as string[]).every(
                (type: string) => !type.startsWith('.')
            )
        ).toBeTruthy();

        // Samsung's WebAPK builder (unlike Chrome's) requires at least a
        // 192x192 "any" icon alongside the 512s, and rejects a manifest
        // whose icons don't actually resolve.
        const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
        const purposes = manifest.icons.map((icon: { purpose?: string }) => icon.purpose);
        expect(sizes).toContain('192x192');
        expect(sizes).toContain('512x512');
        expect(purposes).toContain('any');
        expect(purposes).toContain('maskable');

        for (const icon of manifest.icons as { src: string }[]) {
            expect(icon.src.startsWith('/')).toBeTruthy();
            const iconResponse = await authPage.page.request.get(icon.src);
            expect(iconResponse.ok()).toBeTruthy();
            expect(iconResponse.headers()['content-type']).toBe('image/png');
        }
    });

    customTest('Samsung Internet is served a GET share_target so WebAPK install does not fail', async ({ page }) => {
        const samsungUA = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/122.0.0.0 Mobile Safari/537.36';
        const response = await page.request.get('/manifest.json', {
            headers: { 'User-Agent': samsungUA },
        });
        expect(response.ok()).toBeTruthy();
        expect(response.headers()['content-type']).toMatch(/application\/json/);
        const manifest = await response.json();
        expect(manifest.share_target.action).toBe('/share-target');
        expect(manifest.share_target.method).toBe('GET');
        expect(manifest.share_target.enctype).toBe('application/x-www-form-urlencoded');
        expect(manifest.share_target.params.files).toBeUndefined();
        expect(manifest.orientation).toBeUndefined();
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

    customTest('GET share-target (Samsung WebAPK path) opens the picker with the shared text', async ({ authPage, loginData }) => {
        const sharedTitle = `Shared via GET ${Date.now()}`;
        await authPage.getLoginPage().navigateToLoginPage();
        const anotherLoginData = dataSet.find(user => user.username !== loginData.username);
        const recipient = anotherLoginData?.username.split('@')[0] || '';
        const chat = authPage.getChatPage();

        await chat.shareContentViaShareTargetGet({
            title: sharedTitle,
            text: 'Shared from Samsung Internet',
            url: 'https://example.com/from-samsung'
        });

        await expect(chat.shareToHeader).toBeVisible({ timeout: 10000 });
        await chat.conversationForm.participantLabel
            .filter({ hasText: recipient })
            .click();
        await chat.conversationForm.startChattingButton.click();

        await expect(chat.messageInput).toHaveValue(new RegExp(sharedTitle));
        await expect(chat.messageInput).toHaveValue(/example\.com\/from-samsung/);
    });
});

customTest.describe('PWA share target - logged out / no valid session', () => {
    customTest.use({ storageState: { cookies: [], origins: [] } });

    customTest('Service worker script is reachable from a logged-out page', async ({ page }) => {
        await page.goto('/');
        const response = await page.request.get('/service-worker.js');
        expect(response.ok()).toBeTruthy();
        expect(response.headers()['content-type']).toContain('javascript');
    });

    customTest('Unauthenticated POST to /share-target 303s to login, never 500s', async ({ page, baseURL }) => {
        const response = await page.request.post('/share-target', {
            multipart: { title: '', text: 'hello from the OS share sheet', url: '' },
            maxRedirects: 0,
        });

        expect(response.status()).toBe(303);
        const location = response.headers()['location'];
        expect(location).toBeTruthy();
        // Next.js relativizes the Location header when the redirect target's
        // origin matches the request's own (as here, in dev) - built from
        // NEXT_PUBLIC_BASE_ADDRESS rather than req.url either way, so it
        // still resolves correctly against baseURL when it isn't relative.
        expect(new URL(location!, baseURL).pathname).toBe('/login');

        // Following the redirect as the browser would (a GET) must actually
        // land on a working login page, not another error.
        await page.goto(location!);
        await expect(page).toHaveURL(/\/login$/);
    });

    customTest('Unauthenticated GET to /share-target 303s to login, never 500s', async ({ page, baseURL }) => {
        const response = await page.request.get('/share-target?text=hello-from-samsung', {
            maxRedirects: 0,
        });

        expect(response.status()).toBe(303);
        const location = response.headers()['location'];
        expect(location).toBeTruthy();
        expect(new URL(location!, baseURL).pathname).toBe('/login');
    });

    customTest('POST to /share-target with an invalid session cookie 303s to login, never 500s', async ({ browser, baseURL }) => {
        const context = await browser.newContext({ ignoreHTTPSErrors: true });
        const domain = new URL(baseURL || 'https://localhost:3000').hostname;
        await context.addCookies([
            {
                name: 'user',
                value: TESTS_DATA.FAKE_TOKEN_COOKIE.invalid_token,
                domain: domain === 'localhost' ? 'localhost' : domain,
                path: '/',
                expires: 1767986305.408707,
                httpOnly: true,
                secure: true,
                sameSite: 'Lax',
            },
        ]);
        const page = await context.newPage();

        const response = await page.request.post('/share-target', {
            multipart: { title: '', text: 'hello from the OS share sheet', url: '' },
            maxRedirects: 0,
        });

        expect(response.status()).toBe(303);
        const location = response.headers()['location'];
        expect(location).toBeTruthy();
        expect(new URL(location!, baseURL).pathname).toBe('/login');

        await context.close();
    });
});
