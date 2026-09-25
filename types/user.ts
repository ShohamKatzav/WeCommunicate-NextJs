import type { Locale } from '@/app/i18n/config';

export default interface User {
    email?: string,
    nickname?: string,
    token?: string,
    isModerator?: boolean,
    avatarUrl?: string,
    accentColor?: string,
    locale?: Locale
}
