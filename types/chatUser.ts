export default interface ChatUser {
    _id: string;
    socketId: number;
    email?: string | undefined;
    nickname?: string | undefined;
    unreadCount: number;
    avatarUrl?: string;
    accentColor?: string;
    // Only set once someone has actually been online and left - a user who
    // has never connected has none, and one who is connected right now has a
    // stale one. Presence (see useSocketEvents) decides which of the two is
    // shown.
    lastSeen?: string | Date;
}
