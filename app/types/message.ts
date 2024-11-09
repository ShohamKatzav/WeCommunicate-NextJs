export default interface Message {
    date?: Date | undefined;
    sender?: string | undefined;
    participantID?: string | undefined;
    value?: string;
    conversationID?: string | undefined;
 }