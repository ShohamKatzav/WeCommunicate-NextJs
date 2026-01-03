import ChatUser from "./chatUser";
import Message from "./message";

export default interface Conversation {
    _id?: string | undefined;
    members: ChatUser[];
    messages?: Message[];
    deletedBy?: string[];
}