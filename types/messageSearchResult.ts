interface MatchedMessage {
    text: string;
    date: Date;
    sender: string;
}

export default interface MessageSearchResult {
    conversationID: string;
    // Up to MAX_MATCHES_PER_CONVERSATION matches, most recent first.
    matches: MatchedMessage[];
    // Matches found beyond the ones included above (within the scanned
    // window) - 0 when `matches` already has everything found.
    moreCount: number;
}
