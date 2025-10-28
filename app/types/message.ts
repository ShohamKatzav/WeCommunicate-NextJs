import File from "./file";

export default interface Message {
    date?: Date | undefined;
    sender?: string | undefined;
    text?: string | undefined;
    file?: File | undefined | null;
    participantID?: string[] | undefined;
    conversationID?: string | undefined;
}