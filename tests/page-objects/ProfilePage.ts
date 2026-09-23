import { Locator, Page } from "@playwright/test";
import Navbar from "../components/Navbar";

export default class ProfilePage {

    page: Page;
    navbar: Navbar;
    nicknameHeading: Locator;
    aboutText: Locator;
    accentSwatch: Locator;
    editProfileLink: Locator;

    nicknameInput: Locator;
    aboutInput: Locator;
    saveButton: Locator;
    cancelButton: Locator;

    // Phone number editor (see app/components/profile/phoneNumberEditor.tsx) - a
    // three-step widget (view -> enter new number -> enter emailed OTP)
    // rather than a plain input, so it gets its own set of locators. Scoped
    // to its own data-testid root: the email editor below shares the same
    // "Add"/"Change" button label in its own view step, so an unscoped
    // getByRole would match both and fail strict mode.
    phoneEditor: Locator;
    phoneAddOrChangeButton: Locator;
    newPhoneInput: Locator;
    sendPhoneCodeButton: Locator;
    phoneOtpInput: Locator;
    confirmPhoneButton: Locator;
    resendPhoneCodeButton: Locator;

    // Email address editor (see app/components/profile/emailAddressEditor.tsx) - a
    // four-step widget (view -> enter new address -> verify current contact
    // -> verify new address).
    emailEditor: Locator;
    emailAddOrChangeButton: Locator;
    newEmailInput: Locator;
    sendEmailCodeButton: Locator;
    currentEmailOtpInput: Locator;
    confirmCurrentEmailOtpButton: Locator;
    newEmailOtpInput: Locator;
    confirmNewEmailOtpButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.navbar = new Navbar(page);
        this.nicknameHeading = page.getByTestId('profile-nickname');
        this.aboutText = page.getByTestId('profile-about');
        this.accentSwatch = page.getByTestId('profile-accent-swatch');
        this.editProfileLink = page.getByRole('link', { name: 'Edit profile' });

        this.nicknameInput = page.locator('#nickname');
        this.aboutInput = page.locator('#about');
        this.saveButton = page.getByRole('button', { name: 'Save' });
        this.cancelButton = page.getByRole('button', { name: 'Cancel' });

        this.phoneEditor = page.getByTestId('phone-number-editor');
        this.phoneAddOrChangeButton = this.phoneEditor.getByRole('button', { name: /^(Add|Change)$/ });
        this.newPhoneInput = page.locator('#new-phone');
        this.sendPhoneCodeButton = this.phoneEditor.getByRole('button', { name: 'Send verification code' });
        this.phoneOtpInput = page.locator('#phone-otp');
        this.confirmPhoneButton = this.phoneEditor.getByRole('button', { name: 'Confirm' });
        this.resendPhoneCodeButton = this.phoneEditor.getByRole('button', { name: /Resend/ });

        this.emailEditor = page.getByTestId('email-address-editor');
        this.emailAddOrChangeButton = this.emailEditor.getByRole('button', { name: /^(Add|Change)$/ });
        this.newEmailInput = page.locator('#new-email');
        this.sendEmailCodeButton = this.emailEditor.getByRole('button', { name: 'Send verification code' });
        this.currentEmailOtpInput = page.locator('#current-otp');
        this.confirmCurrentEmailOtpButton = this.emailEditor.getByRole('button', { name: 'Confirm' });
        this.newEmailOtpInput = page.locator('#new-otp');
        this.confirmNewEmailOtpButton = this.emailEditor.getByRole('button', { name: 'Confirm' });
    }

    // The navbar's own name/avatar badge goes straight to /profile/edit
    // (there's no separate "view my profile" nav entry) - see navbar.tsx.
    async navigateToEditViaNavbar(): Promise<void> {
        await Promise.all([
            this.page.waitForURL('**/profile/edit'),
            this.navbar.profileLink.click(),
        ]);
    }

    async navigateToEdit(): Promise<void> {
        await Promise.all([
            this.page.waitForURL('**/profile/edit'),
            this.editProfileLink.click(),
        ]);
    }

    accentColorSwatch(hex: string): Locator {
        return this.page.getByRole('radio', { name: `${hex} accent color` });
    }

    async setAccentColor(hex: string): Promise<void> {
        await this.accentColorSwatch(hex).click();
    }

    async save(): Promise<void> {
        await Promise.all([
            this.page.waitForURL('**/profile'),
            this.saveButton.click(),
        ]);
    }
}
