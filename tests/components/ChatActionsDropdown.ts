import { Locator, Page } from "@playwright/test";


export default class ChatActionsDropdown {

    page: Page;
    dropdownButton: Locator;
    leaveRoomButton: Locator;
    clearHistoryButton: Locator;
    deleteConversationButton: Locator;
    confirmDeletionButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.dropdownButton = page.locator('#dropdown-button');
        this.leaveRoomButton = page.getByText(' Leave Room');
        this.clearHistoryButton = page.getByText(' Clear Room History');
        this.deleteConversationButton = page.getByRole('button', { name: ' Delete Conversation' });
        this.confirmDeletionButton = page.getByRole('button', { name: 'Delete', exact: true });
    }

}
