import FileDTO from '@/types/FileDTO'
import ReplyTo from '@/types/replyTo'
import MessageLocation from '@/types/messageLocation'
import MessageReaction from '@/types/messageReaction'
import MessageCall from '@/types/messageCall'

export default interface Message {
    _id?: string | undefined;
    date?: Date | undefined;
    sender?: string | undefined;
    text?: string | undefined;
    edited?: boolean | undefined;
    status?: string | undefined;
    file?: FileDTO | undefined | null;
    location?: MessageLocation | undefined | null;
    reactions?: MessageReaction[] | undefined;
    participantID?: string[] | undefined;
    conversationID?: string | undefined;
    replyTo?: ReplyTo | undefined;
    call?: MessageCall | undefined | null;
}
