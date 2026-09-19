// Limits shared between client and server. Kept out of the Mongoose models so
// client components can import them without pulling mongoose into the bundle.

// Applied in three places that must agree: the chat inputs (maxLength), the
// saveMessage server action (rejects an oversized payload from any caller) and
// the Message schema (last line of defence). Without a cap, a single client
// could store arbitrarily large documents against a 512MB Atlas allowance.
export const MAX_MESSAGE_LENGTH = 4000;
