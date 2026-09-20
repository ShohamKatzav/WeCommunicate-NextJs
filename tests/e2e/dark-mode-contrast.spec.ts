import { expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { customTest } from '../fixtures/test-base';
import dataSet from "../Data/usersTestData.json" with { type: "json" };

// A regression net for the light/dark/system contrast audit, not the audit
// itself: this checks a representative sample of pages/states rather than
// the full sweep (every page, every modal, every hover state) that was done
// by hand to pick every colour in globals.css's semantic tokens and fix each
// real failure found - see the redesign commit for that. What this guards
// against is a future change quietly reintroducing a bg-*-500-on-white or a
// bg-clip-text gradient with no dark: variant, the two mistakes that caused
// most of the original failures.
async function expectNoContrastViolations(page: import('@playwright/test').Page) {
    const results = await new AxeBuilder({ page }).withTags(['wcag2aa']).include('body').analyze();
    const violations = results.violations.filter(v => v.id === 'color-contrast');
    const details = violations
        .flatMap(v => v.nodes.map(n => `${n.target.join(' ')}: ${n.failureSummary}`))
        .join('\n');
    expect(violations, details).toHaveLength(0);
}

customTest.describe('Dark mode contrast', () => {

    for (const theme of ['light', 'dark'] as const) {

        customTest(`Landing and about pages have no contrast violations [${theme}]`, async ({ page }) => {
            await page.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch { } }, theme);
            await page.goto('/');
            await expectNoContrastViolations(page);

            await page.goto('/about');
            await expectNoContrastViolations(page);
        });

        customTest(`Chat with an open conversation has no contrast violations [${theme}]`, async ({ authPage, loginData }) => {
            await authPage.page.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch { } }, theme);
            await authPage.getLoginPage().navigateToLoginPage();
            const chat = authPage.getChatPage();
            const otherUser = dataSet.find(u => u.username !== loginData.username)!;
            await chat.ensureConversation(otherUser.username.split('@')[0]);
            await expectNoContrastViolations(chat.page);
        });
    }
});
