import FileDTO from '@/types/FileDTO'

export default interface Message {
    _id?: string | undefined;
    date?: Date | undefined;
    sender?: string | undefined;
    text?: string | undefined;
    status?: string | undefined;
    file?: FileDTO | undefined | null;
    participantID?: string[] | undefined;
    conversationID?: string | undefined;
}