import FileDTO from '@/types/FileDTO'
import ReplyTo from '@/types/replyTo'

export default interface Message {
    _id?: string | undefined;
    date?: Date | undefined;
    sender?: string | undefined;
    text?: string | undefined;
    status?: string | undefined;
    file?: FileDTO | undefined | null;
    participantID?: string[] | undefined;
    conversationID?: string | undefined;
    replyTo?: ReplyTo | undefined;
}