import { Locator, Page } from "@playwright/test";


export default class Navbar {

    page: Page;
    links: Locator;
    chatLink: Locator;
    locationsLink: Locator;
    aboutLink: Locator;
    contactLink: Locator;
    profileLink: Locator;
    logOutLink: Locator;
    menuButton: Locator;
    mobileOverlay: Locator;
    mobileThemeToggleButton: Locator;
    desktopThemeToggleButton: Locator;

    constructor(page: Page) {
        this.page = page;
        const navbar = page.locator('nav.navbar');
        this.links = navbar.locator('.nav-links');
        // Navbar renders these link labels lowercase ("chat", "log out", ...)
        // and only capitalizes them visually via a CSS `capitalize` class,
        // which doesn't change the accessible name - so `exact: true` with a
        // capitalized string never matched. A case-insensitive, anchored
        // regex keeps the exact-match intent without depending on casing.
        this.chatLink = navbar.getByRole('link', { name: /^chat$/i });
        this.locationsLink = navbar.getByRole('link', { name: /^locations$/i });
        this.aboutLink = navbar.getByRole('link', { name: /^about$/i });
        this.contactLink = navbar.getByRole('link', { name: /^contact$/i });
        // Not a plain nav-links entry - there's no standalone "profile" link
        // (clicking the user's own name/avatar badge goes straight to
        // /profile/edit), so this is matched by its testid rather than role
        // name, which varies with the signed-in user's display name. The
        // desktop and mobile-overlay badges use distinct testids (unlike the
        // plain text links, which share a role/name and get their duplicate
        // resolved by getByRole excluding the CSS-hidden one) since
        // getByTestId matches raw DOM regardless of display:none - so both
        // would otherwise be in play at once and violate strict mode. Each
        // is only ever actionable in its own breakpoint/overlay state, so
        // :visible picks the right one without the caller needing to know
        // which context it's in.
        this.profileLink = navbar.locator(
            '[data-testid="navbar-profile-link"]:visible, [data-testid="navbar-profile-link-mobile"]:visible'
        );
        this.logOutLink = navbar.getByRole('link', { name: /^log out$/i });
        this.menuButton = navbar.getByRole('button', { name: /open menu|close menu/i });
        // Both the desktop (icon) and mobile (labelled) ThemeToggle are
        // always in the DOM - only CSS display toggles between them per
        // breakpoint - so tests scope to the overlay explicitly rather than
        // matching "the" theme button, which would be ambiguous.
        this.mobileOverlay = page.getByTestId('mobile-nav-overlay');
        this.mobileThemeToggleButton = this.mobileOverlay.getByRole('button', { name: /^Theme:/i });
        this.desktopThemeToggleButton = navbar.locator('ul.hidden').getByRole('button', { name: /^Theme:/i });
    }

    async openMobileMenu(): Promise<void> {
        await this.menuButton.click();
        await this.mobileOverlay.waitFor({ state: 'visible' });
    }

    async logout(): Promise<void> {
        await Promise.all([
            this.page.waitForURL('**/login', { timeout: 10000 }),
            this.logOutLink.click()
        ]);
    }
}
