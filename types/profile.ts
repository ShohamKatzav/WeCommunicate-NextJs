import type { Locale } from '@/app/i18n/config';

export default interface Profile {
    _id: string;
    email?: string;
    phone?: string;
    nickname?: string;
    about?: string;
    avatarUrl?: string;
    accentColor?: string;
    locale?: Locale;
    // Stripped server-side (see profileActions.getProfile) when the viewer
    // has blocked this profile's owner - never present on your own profile.
    lastSeen?: string | Date;
}
