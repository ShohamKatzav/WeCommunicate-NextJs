import ChatUser from "@/types/chatUser";

// Group rooms paint each received bubble with that sender's accent so
// members can be told apart. A 1:1 lists only the other person; their
// accent stays on their profile, and incoming bubbles keep the neutral
// grey. The viewer's own accent already colors their outgoing bubbles,
// and that choice does not travel to the other screen. Built from the
// open conversation's participants, which is the only place the client has
// other people's accent colours; a sender who never picked one (or isn't in
// this list, e.g. a member who has since left) resolves to undefined and
// falls back to the neutral bubble colour.
export const buildAccentBySender = (participants?: ChatUser[] | null) => {
    const accents: Record<string, string> = {};
    participants?.forEach(participant => {
        if (participant.email && participant.accentColor) {
            accents[participant.email.toLowerCase()] = participant.accentColor;
        }
    });
    return accents;
};

// participants is the other members only (the viewer is not in the list).
export const accentsForReceivedBubbles = (participants?: ChatUser[] | null) =>
    participants && participants.length > 1 ? buildAccentBySender(participants) : {};

export const accentForSender = (accents: Record<string, string>, sender?: string) =>
    sender ? accents[sender.toLowerCase()] : undefined;
