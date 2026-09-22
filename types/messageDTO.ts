import FileDTO from "./FileDTO";
import ReplyTo from "./replyTo";
import MessageLocation from "./messageLocation";

export default interface MessageDTO {
    _id?: string;
    date: Date;
    sender: string;
    text?: string;
    file?: FileDTO;
    location?: MessageLocation;
    participantID: string[];
    conversationID: string;
    // Only `messageId` is trusted server-side - SaveMessage re-derives
    // sender/snippet/hasFile from the DB so a client can't fabricate a quote
    // (fake sender + fake text) that looks like it came from someone else.
    replyTo?: ReplyTo;
}