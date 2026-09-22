// Turns a stored last-seen timestamp into the phrase that follows
// "Last seen" - deliberately coarse, because a precise "left 47 seconds ago"
// says more about someone's habits than a chat app needs to.
// Returns null when there's nothing to show (never connected, or an
// unparseable value), so callers can fall back instead of printing
// "Last seen Invalid Date".
export const formatLastSeen = (value?: string | Date | null): string | null => {
    if (!value) return null;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    const elapsedMinutes = Math.floor((Date.now() - date.getTime()) / 60000);
    // A clock skew between the server that stamped this and the viewer's own
    // machine can put it slightly in the future - read that as "just now"
    // rather than printing a negative age.
    if (elapsedMinutes < 1) return 'just now';
    // "min", not "minutes" - this sits in a narrow sidebar row next to a
    // "Last seen" prefix, where the longer word gets ellipsised away.
    if (elapsedMinutes < 60) return `${elapsedMinutes} min ago`;

    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
    const daysAgo = (startOfDay(new Date()) - startOfDay(date)) / 86400000;

    if (daysAgo === 0) return `today at ${time}`;
    if (daysAgo === 1) return `yesterday at ${time}`;

    return `on ${date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' })}`;
};
