// One person's reaction to one message. A user has at most one reaction per
// message - picking a different emoji replaces theirs rather than adding a
// second one (see MessageRepository.ToggleReaction).
export default interface MessageReaction {
    emoji: string;
    sender: string;
}
