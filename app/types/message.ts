import FileDTO from '@/app/types/FileDTO'

export default interface Message {
    date?: Date | undefined;
    sender?: string | undefined;
    text?: string | undefined;
    file?: FileDTO | undefined | null;
    participantID?: string[] | undefined;
    conversationID?: string | undefined;
}