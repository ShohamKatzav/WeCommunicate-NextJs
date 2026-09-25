// Limits shared between client and server. Kept out of the Mongoose models so
// client components can import them without pulling mongoose into the bundle.

// Applied in three places that must agree: the chat inputs (maxLength), the
// saveMessage server action (rejects an oversized payload from any caller) and
// the Message schema (last line of defence). Without a cap, a single client
// could store arbitrarily large documents against a 512MB Atlas allowance.
export const MAX_MESSAGE_LENGTH = 4000;

// Message search scans the caller's own matching messages newest-first,
// picking the most recent one per conversation. Capped so a broad/common
// search term (e.g. a single common word, or even just "e") can't force an
// unbounded regex scan.
export const MAX_SEARCH_MATCHES_SCANNED = 200;

// Results are one row per matching conversation, so the search list can
// never grow larger than this regardless of how many conversations match.
export const MAX_SEARCH_RESULTS = 30;

// How many matching messages are shown per conversation in the search
// results - a conversation with many matches (e.g. a common word used
// repeatedly) still surfaces the most recent few instead of just one,
// with the rest summarized as a "+N more" count.
export const MAX_MATCHES_PER_CONVERSATION = 3;

// How much of a replied-to message's text is denormalized onto the reply as
// a quote preview - a whole MAX_MESSAGE_LENGTH message quoted verbatim would
// dwarf the reply itself.
export const REPLY_SNIPPET_LENGTH = 120;

// Shown in the moderation warning toast ("Warning 2/3") after a send or an
// edit is rejected. Mirrors ModerationService's own warningsBeforeBan.
export const WARNINGS_BEFORE_BAN = 3;

// Voice messages auto-stop recording at this length - without a cap, a
// forgotten open mic would fill up the free-tier blob storage/bandwidth
// quota with one very long recording.
export const MAX_VOICE_MESSAGE_SECONDS = 60;

// Profile "about" bio - short chat-presence line ("Usually online evenings"),
// not a dating-style biography, so it's capped well short of MAX_MESSAGE_LENGTH.
export const ABOUT_MAX_LENGTH = 160;

// Curated accent palette for own-message bubbles / small profile chrome - a
// fixed allowlist (not an arbitrary color picker) so the server can validate
// what it's asked to store instead of trusting client-supplied CSS. The first
// entry doubles as the default, and is deliberately Tailwind's green-700 (the
// bubble color hardcoded before accent colors existed - see messageBubble.tsx)
// so a user who never picks one sees the exact same bubble as today.
export const ACCENT_COLORS = [
    '#15803d', // green (default)
    '#1d4ed8', // blue
    '#7e22ce', // purple
    '#be185d', // pink
    '#c2410c', // orange
    '#0f766e', // teal
    '#4338ca', // indigo
] as const;
export const DEFAULT_ACCENT_COLOR = ACCENT_COLORS[0];

// The reactions a message can carry - the quick row the picker opens with,
// plus a longer curated set behind its "+" button, rather than a full emoji
// keyboard. Shared between the picker and the server action's own
// validation, so a client can't store arbitrary text (or a 400-character
// "emoji") on someone else's message.
export const MESSAGE_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;
export const MORE_MESSAGE_REACTIONS = [
    '😀', '😁', '😅', '🤣', '😊', '😇', '🙂', '😉',
    '😍', '🥰', '😘', '😋', '😜', '🤪', '🤗', '🤔',
    '🤭', '🤫', '😐', '🙄', '😏', '😬', '😴', '😎',
    '🤓', '🥳', '🥺', '😭', '😤', '😡', '🤯', '😱',
    '🤢', '💀', '👎', '👏', '🙌', '💪', '🤝', '👌',
    '✌️', '🤞', '👀', '🔥', '💯', '🎉', '✨', '💔',
] as const;
export const ALL_MESSAGE_REACTIONS: readonly string[] = [...MESSAGE_REACTIONS, ...MORE_MESSAGE_REACTIONS];

// Selectable disappearing-messages durations, in seconds - 0 means off.
// Shared between the picker UI and the server action's own validation (only
// these exact values are accepted, not an arbitrary client-supplied number).
export const DISAPPEARING_MESSAGES_OPTIONS = [
    { label: 'Off', seconds: 0 },
    { label: '24 hours', seconds: 24 * 60 * 60 },
    { label: '7 days', seconds: 7 * 24 * 60 * 60 },
] as const;

// Typing indicator timing, shared by the sender (useChatRoom.tsx) and the
// receiver (useSocketEvents.tsx). The sender sends 'stop typing' after
// TYPING_IDLE_MS without a keystroke, and repeats 'start typing' at most
// every TYPING_REFRESH_MS while keys keep coming. A receiver drops an
// indicator it hasn't heard about for TYPING_EXPIRE_MS - long enough to ride
// out a missed refresh, and the backstop for a sender that vanishes without
// any stop at all (a phone losing signal is only noticed by the server at
// its ping timeout, ~45s later).
export const TYPING_IDLE_MS = 3000;
export const TYPING_REFRESH_MS = 3000;
export const TYPING_EXPIRE_MS = 8000;
