import { Locator, Page } from "@playwright/test";


export default class ChatActionsDropdown {

    page: Page;
    dropdownButton: Locator;
    private conversationDetailsButton: Locator;
    private leaveRoomButton: Locator;
    private clearHistoryButton: Locator;
    private deleteConversationButton: Locator;
    private confirmDeletionButton: Locator;
    conversationDetailsModal: Locator;

    constructor(page: Page) {
        this.page = page;
        this.dropdownButton = page.locator('#dropdown-button');
        this.conversationDetailsButton = page.getByText(' Conversation Details');
        this.leaveRoomButton = page.getByText(' Leave Room');
        this.clearHistoryButton = page.getByText(' Clear Room History');
        this.deleteConversationButton = page.getByRole('button', { name: ' Delete Conversation' });
        this.confirmDeletionButton = page.getByRole('button', { name: 'Delete', exact: true });
        this.conversationDetailsModal = page.locator('#conversation-details-modal');
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
}
