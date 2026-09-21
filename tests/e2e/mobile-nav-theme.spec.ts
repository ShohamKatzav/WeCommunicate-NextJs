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

        // Theme still actually changes.
        await page.getByRole('menuitemradio', { name: 'Dark' }).click();
        await expect(page.locator('html')).toHaveClass(/dark/);
    });

    customTest('Overlay scrolls instead of clipping when its content is taller than the viewport', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 320 });
        await page.goto('/');
        const nav = new Navbar(page);

        await nav.openMobileMenu();
        // The theme row is the last item in the overlay - on a very short
        // viewport it only becomes visible by scrolling the overlay itself.
        await nav.mobileThemeToggleButton.scrollIntoViewIfNeeded();
        await expect(nav.mobileThemeToggleButton).toBeVisible();
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
