import { expect, Locator, Page } from "@playwright/test";


export default class ChatActionsDropdown {

    page: Page;
    dropdownButton: Locator;
    private conversationDetailsButton: Locator;
    private leaveRoomButton: Locator;
    private clearHistoryButton: Locator;
    private deleteConversationButton: Locator;
    private confirmDeletionButton: Locator;
    private disappearingMessagesButton: Locator;
    conversationDetailsModal: Locator;
    disappearingMessagesHeading: Locator;
    disappearingMessagesSaveButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.dropdownButton = page.locator('#dropdown-button');
        this.conversationDetailsButton = page.getByText(' Conversation Details');
        this.leaveRoomButton = page.getByText(' Leave Room');
        this.clearHistoryButton = page.getByText(' Clear Room History');
        // exact: true - conversation rows are now real <button>s too
        // (keyboard accessibility fix), so a fuzzy/substring name match here
        // can ambiguously match a row whose content happens to contain this
        // text, not just the actual dropdown menu item.
        this.deleteConversationButton = page.getByRole('button', { name: 'Delete Conversation', exact: true });
        this.confirmDeletionButton = page.getByRole('button', { name: 'Delete', exact: true });
        this.disappearingMessagesButton = page.getByRole('button', { name: 'Disappearing Messages' });
        this.conversationDetailsModal = page.locator('#conversation-details-modal');
        this.disappearingMessagesHeading = page.getByRole('heading', { name: 'Disappearing Messages' });
        this.disappearingMessagesSaveButton = page.getByRole('button', { name: 'Save' });
    }

    async openConversationDetails(): Promise<void> {
        await this.dropdownButton.click();
        await this.conversationDetailsButton.click();
    }
    async leaveRoom(): Promise<void> {
        await this.dropdownButton.click();
        await this.leaveRoomButton.click();
    }
    async clearHistory(): Promise<void> {
        await this.dropdownButton.click();
        await this.clearHistoryButton.click();
    }
    async deleteConversation(): Promise<void> {
        await this.dropdownButton.click();
        await this.deleteConversationButton.click();
        await this.confirmDeletionButton.click();
    }

    async deletionModalClosed(): Promise<boolean> {
        return await this.deleteConversationButton.isHidden();
    }

    async openDisappearingMessages(): Promise<void> {
        await this.dropdownButton.click();
        await this.disappearingMessagesButton.click();
        await this.disappearingMessagesHeading.waitFor({ state: 'visible' });
    }

    getDisappearingDurationOption(label: string): Locator {
        return this.page.getByRole('radio', { name: label });
    }

    async setDisappearingDuration(label: string): Promise<void> {
        if (!(await this.disappearingMessagesHeading.isVisible().catch(() => false))) {
            await this.openDisappearingMessages();
        }
        const option = this.getDisappearingDurationOption(label);
        await expect(option).toBeEnabled({ timeout: 10000 });
        await option.click();
        await this.disappearingMessagesSaveButton.click();
        await this.disappearingMessagesHeading.waitFor({ state: 'hidden' });
    }
}
