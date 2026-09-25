export default interface ReplyTo {
    messageId: string;
    sender: string;
    snippet: string;
    hasFile?: boolean;
    // A quoted pin. Its snippet is empty, like a quoted file's, so each
    // reader sees "Shared a location" in their own language.
    hasLocation?: boolean;
}
