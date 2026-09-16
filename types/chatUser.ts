export default interface ChatUser {
    _id: string;
    socketId: number;
    email?: string | undefined;
    nickname?: string | undefined;
    unreadCount: number;
}
