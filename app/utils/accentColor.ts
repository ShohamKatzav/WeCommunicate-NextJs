import ChatUser from "@/types/chatUser";

// Received bubbles are painted with the *sender's* own accent (the same
// colour their profile shows), so each side of a conversation keeps its
// identity - own bubbles already used the viewer's accent. Built from the
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

export const accentForSender = (accents: Record<string, string>, sender?: string) =>
    sender ? accents[sender.toLowerCase()] : undefined;
