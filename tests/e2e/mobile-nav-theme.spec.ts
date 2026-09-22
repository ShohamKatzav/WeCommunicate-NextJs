import { expect } from '@playwright/test';
import { customTest } from '../fixtures/test-base';
import Navbar from '../components/Navbar';

customTest.use({ storageState: { cookies: [], origins: [] } });

customTest.describe('Mobile hamburger menu - theme control alignment', () => {
    customTest.use({ viewport: { width: 375, height: 667 } });

    customTest('Theme control lines up with the other overlay rows', async ({ page }) => {
        await page.goto('/');
        const nav = new Navbar(page);

        await nav.openMobileMenu();
        await expect(nav.mobileThemeToggleButton).toBeVisible();

        const linkBox = await nav.aboutLink.boundingBox();
        const themeBox = await nav.mobileThemeToggleButton.boundingBox();
        expect(linkBox).not.toBeNull();
        expect(themeBox).not.toBeNull();

        const linkCenterX = linkBox!.x + linkBox!.width / 2;
        const themeCenterX = themeBox!.x + themeBox!.width / 2;
        // "Roughly centered": both rows share the same horizontal center as
        // the rest of the overlay's centered links, not pinned to the left
        // edge as a separate, narrower block underneath them.
        expect(Math.abs(linkCenterX - themeCenterX)).toBeLessThan(20);

        // Opening the dropdown must stay fully inside the viewport width.
        await nav.mobileThemeToggleButton.click();
        const menu = page.getByRole('menu', { name: 'Theme' });
        await expect(menu).toBeVisible();
        const menuBox = await menu.boundingBox();
        expect(menuBox).not.toBeNull();
        expect(menuBox!.x).toBeGreaterThanOrEqual(0);
        expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(375);

        // It overlays whatever is under it, so it needs a solid background -
        // a translucent one would let those rows show through underneath it.
        const backgroundColor = await menu.evaluate((el) => getComputedStyle(el).backgroundColor);
        const alpha = Number(backgroundColor.match(/[\d.]+/g)?.[3] ?? '1');
        expect(alpha).toBe(1);

        // Theme still actually changes.
        await page.getByRole('menuitemradio', { name: 'Dark' }).click();
        await expect(page.locator('html')).toHaveClass(/dark/);
    });

    customTest('Overlay scrolls instead of clipping when its content is taller than the viewport', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 320 });
        await page.goto('/');
        const nav = new Navbar(page);

        await nav.openMobileMenu();
        // Signed out, the theme row is the last item in the overlay - on a
        // very short viewport it only becomes visible by scrolling.
        await nav.mobileThemeToggleButton.scrollIntoViewIfNeeded();
        await expect(nav.mobileThemeToggleButton).toBeVisible();
    });

    customTest.describe('Signed in - rows below the theme row', () => {
        customTest.use({ storageState: 'tests/state1.json' });

        customTest('Opening the theme menu overlays profile and log out instead of pushing them down', async ({ page }) => {
            // Signed-in visitors hitting "/" get redirected straight to
            // /chat (see proxy.ts) - going there directly avoids racing
            // that redirect, which would otherwise remount the navbar and
            // silently close the overlay right after it opens. Waiting for
            // the chat sidebar to render first sidesteps a second remount:
            // the page's own concurrent mount-time server actions can
            // otherwise reset the navbar's open state right after it opens.
            await page.goto('/chat');
            await expect(page.getByRole('heading', { name: 'Chats' })).toBeVisible();
            const nav = new Navbar(page);

            await nav.openMobileMenu();
            await expect(nav.mobileThemeToggleButton).toBeVisible();
            await expect(nav.profileLink).toBeVisible();
            await expect(nav.logOutLink).toBeVisible();

            const profileBoxBeforeOpen = await nav.profileLink.boundingBox();
            const logOutBoxBeforeOpen = await nav.logOutLink.boundingBox();
            expect(profileBoxBeforeOpen).not.toBeNull();
            expect(logOutBoxBeforeOpen).not.toBeNull();

            await nav.mobileThemeToggleButton.click();
            const menu = page.getByRole('menu', { name: 'Theme' });
            await expect(menu).toBeVisible();

            const profileBoxWhileOpen = await nav.profileLink.boundingBox();
            const logOutBoxWhileOpen = await nav.logOutLink.boundingBox();
            expect(profileBoxWhileOpen).not.toBeNull();
            expect(logOutBoxWhileOpen).not.toBeNull();
            expect(profileBoxWhileOpen!.y).toBeCloseTo(profileBoxBeforeOpen!.y, 0);
            expect(logOutBoxWhileOpen!.y).toBeCloseTo(logOutBoxBeforeOpen!.y, 0);

            // Closing it again leaves both rows exactly where they started.
            await nav.mobileThemeToggleButton.click();
            await expect(menu).toBeHidden();
            const profileBoxAfterClose = await nav.profileLink.boundingBox();
            const logOutBoxAfterClose = await nav.logOutLink.boundingBox();
            expect(profileBoxAfterClose).not.toBeNull();
            expect(logOutBoxAfterClose).not.toBeNull();
            expect(profileBoxAfterClose!.y).toBeCloseTo(profileBoxBeforeOpen!.y, 0);
            expect(logOutBoxAfterClose!.y).toBeCloseTo(logOutBoxBeforeOpen!.y, 0);
        });
    });
});

customTest.describe('Desktop nav - theme toggle unaffected', () => {
    customTest('Desktop keeps the icon-only theme toggle in the nav row', async ({ page }) => {
        await page.goto('/');
        const nav = new Navbar(page);

        await expect(nav.desktopThemeToggleButton).toBeVisible();
        await expect(nav.mobileThemeToggleButton).toBeHidden();
    });
});
