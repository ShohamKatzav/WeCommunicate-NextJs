import type { TFunction } from "../i18n/messages";

type DateInput = string | number | Date;

// Calendar days in the viewer's local time, not 24-hour gaps: a message at
// 23:59 and one at 00:01 are on different days. Rounded because a day that
// crosses a DST change is 23 or 25 hours long.
export const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();

export const isSameDay = (a: DateInput, b: DateInput): boolean =>
    startOfDay(new Date(a)) === startOfDay(new Date(b));

// The day chip shown in the message list whenever the calendar day changes,
// relative to `now` (see useLocalDay, which moves it on at midnight).
// "Today"/"Yesterday" are catalog words; weekday names and numeric dates
// come from Intl in the active locale.
export const formatDayLabel = (value: DateInput, t: TFunction, now: DateInput = Date.now()): string => {
    const date = new Date(value);
    const daysAgo = Math.round((startOfDay(new Date(now)) - startOfDay(date)) / 86400000);

    // A date slightly in the future (clock skew with the server) is still today.
    if (daysAgo <= 0) return t('dates.today');
    if (daysAgo === 1) return t('dates.yesterday');
    if (daysAgo <= 7) return date.toLocaleDateString(t.dateLocale, { weekday: 'long' });

    return date.toLocaleDateString(t.dateLocale, { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// Whether a message at `date` starts a new day in the list: the first shown,
// or the first one on a different calendar day from the one before it.
export const startsNewDay = (date?: DateInput, previousDate?: DateInput): boolean =>
    !!date && (!previousDate || !isSameDay(date, previousDate));
