import type { TFunction } from '../i18n/messages';

// Turns a stored last-seen timestamp into the whole "Last seen ..." line -
// deliberately coarse, because a precise "left 47 seconds ago" says more
// about someone's habits than a chat app needs to. The whole line rather
// than a fragment after an English "Last seen", since other languages don't
// put the time in the same place.
// Returns null when there's nothing to show (never connected, or an
// unparseable value), so callers can fall back instead of printing
// "Last seen Invalid Date".
export const formatLastSeen = (value: string | Date | null | undefined, t: TFunction): string | null => {
    if (!value) return null;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    const elapsedMinutes = Math.floor((Date.now() - date.getTime()) / 60000);
    // A clock skew between the server that stamped this and the viewer's own
    // machine can put it slightly in the future - read that as "just now"
    // rather than printing a negative age.
    if (elapsedMinutes < 1) return t('presence.lastSeenJustNow');
    // "min", not "minutes" - this sits in a narrow sidebar row, where the
    // longer word gets ellipsised away.
    if (elapsedMinutes < 60) return t('presence.lastSeenMinutes', { count: elapsedMinutes });

    const time = date.toLocaleTimeString(t.dateLocale, { hour: '2-digit', minute: '2-digit', hour12: false });
    const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
    const daysAgo = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);

    if (daysAgo === 0) return t('presence.lastSeenToday', { time });
    if (daysAgo === 1) return t('presence.lastSeenYesterday', { time });

    return t('presence.lastSeenOn', { date: date.toLocaleDateString(t.dateLocale, { day: '2-digit', month: '2-digit', year: '2-digit' }) });
};
