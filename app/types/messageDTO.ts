import FileDTO from "./FileDTO";

export default interface MessageDTO {
    date: Date;
    sender: string;
    text?: string;
    file?: FileDTO;
    participantID: string[];
    conversationID: string;
}