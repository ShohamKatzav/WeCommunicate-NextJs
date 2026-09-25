import ChatUser from '@/types/chatUser';

// Brings back the conversation that was open when someone left /chat for
// another user's profile. The open room lives only in useChatRoom's refs,
// and leaving /chat unmounts it, so the profile's Back button would
// otherwise land on the empty welcome state.
//
// 1. A link into /profile/[id] from chat calls rememberChatForProfile at
//    click time, saving whatever room is open (or none).
// 2. That profile's Back button calls armChatReturn.
// 3. ChatClient's mount calls takeChatReturn, which always clears the
//    snapshot and hands back the room only if Back armed it - so reaching
//    /chat any other way (navbar, a fresh visit) opens nothing.
//
// sessionStorage rather than the URL: the participant list isn't something
// to put in a link someone might share. Drafts already live in localStorage
// (see useChatRoom) and aren't touched here.

type OpenRoom = { conversationId: string; participants: ChatUser[] };
type Snapshot = { profileId: string; room: OpenRoom | null; armed?: boolean };

const STORAGE_KEY = 'wecommunicate_chat_return';

// Set by the mounted useChatRoom, so links anywhere under /chat can read the
// open room without it being threaded through every component.
let readOpenRoom: (() => OpenRoom | null) | null = null;

export const registerOpenRoom = (read: () => OpenRoom | null) => {
    readOpenRoom = read;
    return () => {
        if (readOpenRoom === read) readOpenRoom = null;
    };
};

const load = (): Snapshot | null => {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) as Snapshot : null;
    } catch {
        return null;
    }
};

const save = (snapshot: Snapshot | null) => {
    try {
        if (snapshot) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
        else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
        // Storage disabled - Back still reaches /chat, just without the room.
    }
};

export const rememberChatForProfile = (profileId: string) => {
    save({ profileId, room: readOpenRoom?.() ?? null });
};

// Only for the profile the snapshot was taken for: a profile reached some
// other way (typed URL, a shared link) goes back to an empty /chat rather
// than to a conversation from earlier in the session.
export const armChatReturn = (profileId: string) => {
    const snapshot = load();
    save(snapshot?.profileId === profileId ? { ...snapshot, armed: true } : null);
};

export const takeChatReturn = (): OpenRoom | null => {
    const snapshot = load();
    if (snapshot) save(null);
    return snapshot?.armed && snapshot.room?.participants?.length ? snapshot.room : null;
};
