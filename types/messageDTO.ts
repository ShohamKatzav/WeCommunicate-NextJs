import FileDTO from "./FileDTO";

export default interface MessageDTO {
    _id?: string;
    date: Date;
    sender: string;
    text?: string;
    file?: FileDTO;
    participantID: string[];
    conversationID: string;
}