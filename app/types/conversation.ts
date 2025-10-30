import ChatUser from "./chatUser";
import MessageDTO from "./messageDTO";

export default interface Conversation {
    _id?: string | undefined;
    members: ChatUser[];
    messages?: MessageDTO[];
}