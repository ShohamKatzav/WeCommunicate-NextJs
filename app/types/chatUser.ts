export default interface ChatUser {
    _id?: string | undefined;
    socketId: number;
    email?: string | undefined;
    unreadCount: number;
 }