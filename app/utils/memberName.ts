import ChatUser from '@/types/chatUser';
import type { TFunction } from '../i18n/messages';
import { AsShortName } from './stringFormat';

// A conversation member's name as the chat shows it: the nickname exactly as
// typed ("@" included), or - only when there is none - the part of the email
// address before the "@". A deleted account has no name left to show (see
// ConversationRepository.withDeletedMembers) - only that it was deleted.
// The same string everywhere; where space is short (the sidebars), the row
// ellipsizes it rather than this rewriting it.
export const memberName = (member: Pick<ChatUser, 'nickname' | 'email' | 'deleted'>, t: TFunction) =>
    member.deleted ? t('chat.deletedAccount') : member.nickname || AsShortName(member.email);
