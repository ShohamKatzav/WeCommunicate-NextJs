import ChatUser from "@/types/chatUser";
import Link from "next/link";
import { rememberChatForProfile } from "../../utils/chatReturn";
import { SetStateAction, useEffect, useState } from "react";
import { HiChatBubbleLeftRight, HiUsers } from "react-icons/hi2";
import { Phone, Timer, Video } from "lucide-react";
import { AsShortName } from "../../utils/stringFormat";
import { formatLastSeen } from "../../utils/lastSeen";
import { memberName } from "../../utils/memberName";
import { useUser } from "../../hooks/useUser";
import ChatDropdown from "./chatDropdown";
import Avatar from "../ui/avatar";
import Message from "@/types/message";
import { getDisappearingMessagesSetting } from "../../lib/conversationActions";
import { DISAPPEARING_MESSAGES_OPTIONS } from "../../config/limits";
import useMediaDeviceAvailability from "../../hooks/useMediaDeviceAvailability";
import { unavailableDevicesReason } from "../../lib/mediaDeviceError";
import { useT } from "../../i18n/client";

// Every icon button in the header shares one box: 44px on phones (the usual
// minimum touch target), 40px from md up where a pointer is likely. The
// conversation menu's trigger (chatDropdown.tsx) uses the same box.
const ICON_BUTTON = "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-purple-600 outline-none transition-colors hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-purple-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent md:h-10 md:w-10 dark:text-purple-400 dark:hover:bg-gray-700";

interface ChatHeaderProps {
    setMobileChatsSidebarOpen: (value: SetStateAction<boolean>) => void;
    setMobileUsersSidebarOpen: (value: SetStateAction<boolean>) => void;
    participants: React.RefObject<ChatUser[] | null | undefined>;
    handleLeaveRoom: () => Promise<void>;
    chat: Message[];
    setChat: (newChat: Message[]) => void;
    conversationId: string;
    updateConversationsBar: (message: Message | null, mode?: string, cleanId?: string) => Promise<void>;
    typingUsers: Record<string, boolean>;
    activeSocketUsers: ChatUser[];
    setPendingClear: (conversationId: string, clearedAt: string) => void;
    lastSeenByEmail: Record<string, string>;
    isBlocked: boolean;
    onStartCall: (video: boolean) => void;
    ensureConversationId: () => Promise<string>;
}

const ChatHeader = ({
    setMobileChatsSidebarOpen,
    setMobileUsersSidebarOpen,
    participants,
    handleLeaveRoom,
    chat,
    setChat,
    conversationId,
    updateConversationsBar,
    typingUsers,
    activeSocketUsers,
    setPendingClear,
    lastSeenByEmail,
    isBlocked,
    onStartCall,
    ensureConversationId }: ChatHeaderProps) => {
    const t = useT();

    const { user } = useUser();
    const devices = useMediaDeviceAvailability();

    const [onlineCount, setOnlineCount] = useState(0);
    // Without this the disappearing-messages setting is invisible once set -
    // you'd have to reopen the dropdown to remember whether this conversation
    // is on a timer. Kept in sync on save via onDisappearingMessagesChange
    // below, so it never shows a stale value.
    const [disappearingSeconds, setDisappearingSeconds] = useState(0);

    useEffect(() => {
        getOnlineParticipantsInRoom();
    }, [participants.current, activeSocketUsers, conversationId]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!conversationId) {
                if (!cancelled) setDisappearingSeconds(0);
                return;
            }
            const result = await getDisappearingMessagesSetting(conversationId);
            if (!cancelled) setDisappearingSeconds(result.success ? result.seconds : 0);
        })();
        return () => { cancelled = true; };
    }, [conversationId]);

    const disappearingLabelKey = DISAPPEARING_MESSAGES_OPTIONS
        .find(option => option.seconds === disappearingSeconds && option.seconds !== 0)?.labelKey;
    const disappearingLabel = disappearingLabelKey ? t(disappearingLabelKey) : undefined;

    // 1:1 only - a group has several people with several last-seen times,
    // and the header already summarises those as "N of M members online".
    // Never shown for a blocked user, matching the users list.
    const otherParticipant = participants.current?.length === 1 ? participants.current[0] : undefined;
    // The other person deleted their account: the chat stays, with no one
    // to reach - no profile, presence or calls.
    const recipientDeleted = !!otherParticipant?.deleted;
    const lastSeenText = (!otherParticipant || isBlocked || recipientDeleted)
        ? null
        : formatLastSeen(
            (otherParticipant.email ? lastSeenByEmail[otherParticipant.email.toLowerCase()] : undefined)
            ?? otherParticipant.lastSeen,
            t
        );

    // Calls are 1:1 only (see the call handlers in socket/handlers.ts) and
    // never reach a blocked user. They don't require a conversation to
    // exist yet - onStartCall creates one on demand (ensureConversationId)
    // if this is a brand-new chat with no messages.
    const canCall = !!otherParticipant && !isBlocked && !recipientDeleted;
    const callTargetName = otherParticipant ? memberName(otherParticipant, t) : "";
    // Voice calls need a microphone; video calls need a microphone and a
    // camera (getMedia(true, video) in callController.ts). getUserMedia would
    // already reject and toast this once a call is attempted; disabling up
    // front (not hiding - the buttons still explain themselves) names the
    // device that is actually missing.
    const voiceUnavailable = unavailableDevicesReason({ audio: true, video: false }, devices, t);
    const videoUnavailable = unavailableDevicesReason({ audio: true, video: true }, devices, t);

    const getOnlineParticipantsInRoom = () => {
        if (!participants.current) return [];
        const count = participants.current.filter(p =>
            activeSocketUsers.some(active => active.email === p.email)
        ).length;
        setOnlineCount(count);
    };

    const roomParticipants = participants.current;
    const isGroup = (roomParticipants?.length ?? 0) > 1;
    // The person (or people) this conversation is with - not the signed-in
    // user, who is already named in the navbar. A group lists its members;
    // nothing here is ever truncated, it wraps instead.
    const conversationTitle = roomParticipants
        ?.map(p => memberName(p, t))
        .join(", ");
    // A deleted account in a group isn't a member who could be online.
    const liveMemberCount = roomParticipants?.filter(p => !p.deleted).length ?? 0;
    const presenceText = isGroup
        ? t("chat.header.membersOnline", { online: onlineCount, count: liveMemberCount })
        : recipientDeleted
            ? t("chat.header.accountDeleted")
            : onlineCount > 0
            ? t("presence.online")
            : lastSeenText ?? t("chat.header.notHere");
    const typingEmails = Object.keys(typingUsers);

    return (
        // One wrapping flex row whose children are placed with order-*, so
        // each control exists once and CSS decides where it sits:
        // - Phone: row 1 is [conversations] [avatar, name, presence]
        //   [people]; the basis-full spacer breaks the line, and row 2 is
        //   [disappearing label] [voice, video, menu].
        // - md and up: one row, people moves to the far end. Not from sm:
        //   at 640px the pill and five buttons leave a long name ~150px, so
        //   it wrapped into a header taller than the two-row phone layout.
        // - xl: both sidebar toggles hide (the sidebars are always open).
        // items-start on phones keeps the two toggles pinned to the top
        // instead of drifting as the name/presence block grows or the typing
        // indicator swaps in.
        <div className="flex flex-wrap items-start gap-x-2 gap-y-1 border-b px-2 py-2 md:flex-nowrap md:items-center md:px-3 dark:border-gray-700">
            <button
                type="button"
                onClick={() => setMobileChatsSidebarOpen(true)}
                aria-label={t("chat.header.openConversations")}
                className={`order-1 xl:hidden ${ICON_BUTTON}`}
            >
                <HiChatBubbleLeftRight color="rgb(152, 65, 249)" size={24} aria-hidden="true" />
            </button>

            <div className="order-2 flex min-h-11 min-w-0 flex-1 basis-0 items-center gap-2.5 md:min-h-10">
                {otherParticipant && recipientDeleted && (
                    <Avatar deleted size={40} className="self-start md:self-center" />
                )}
                {otherParticipant && !recipientDeleted && (
                    <Link
                        href={`/profile/${otherParticipant._id}`}
                        onClick={() => rememberChatForProfile(otherParticipant._id)}
                        aria-label={t("chat.header.viewProfile", { name: callTargetName })}
                        className="shrink-0 self-start rounded-full outline-none focus-visible:ring-2 focus-visible:ring-purple-500 md:self-center"
                    >
                        <Avatar
                            avatarUrl={otherParticipant.avatarUrl}
                            nickname={otherParticipant.nickname}
                            email={otherParticipant.email}
                            size={40}
                        />
                    </Link>
                )}

                {roomParticipants ? (
                    // #ConversationInfo wraps the name and presence together -
                    // the e2e tests read the participant's name and the group
                    // "members online" line from it.
                    <div className="min-w-0 flex-1" id="ConversationInfo">
                        <h1 className="wrap-break-word text-base font-semibold leading-5 text-gray-900 md:text-lg md:leading-6 xl:text-xl dark:text-white">
                            {conversationTitle}
                        </h1>

                        {/* Typing replaces only this line, so the name above
                            stays on screen while they type. */}
                        {typingEmails.length > 0 ? (
                            <div className="mt-0.5 flex min-h-4 min-w-0 items-center gap-1.5">
                                <div className="flex shrink-0 gap-0.5" aria-hidden="true">
                                    <span className="h-1 w-1 animate-bounce rounded-full bg-purple-500 [animation-delay:-0.3s]"></span>
                                    <span className="h-1 w-1 animate-bounce rounded-full bg-purple-500 [animation-delay:-0.15s]"></span>
                                    <span className="h-1 w-1 animate-bounce rounded-full bg-purple-500"></span>
                                </div>
                                <span className="wrap-break-word text-xs font-medium italic leading-4 text-purple-600 dark:text-purple-400">
                                    {typingEmails.length === 1
                                        ? t("chat.header.typing", { name: AsShortName(typingEmails[0]) })
                                        : t("chat.header.multipleTyping")
                                    }
                                </span>
                            </div>
                        ) : (
                            <div className="mt-0.5 flex min-h-4 min-w-0 items-start gap-1.5 text-xs leading-4 text-muted-foreground">
                                <span className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full ${onlineCount > 0 ? 'bg-green-500' : 'bg-gray-500'}`} aria-hidden="true"></span>
                                <span className="wrap-break-word">{presenceText}</span>
                            </div>
                        )}
                    </div>
                ) : (
                    // No conversation open: the greeting lives here now, not
                    // above every open chat (the login tests look for it right
                    // after sign-in, when nothing is open yet).
                    <div className="min-w-0 flex-1">
                        <h1 className="wrap-break-word text-lg font-bold leading-6 md:text-xl xl:text-2xl">
                            <span className="bg-linear-to-r from-blue-600 to-purple-700 bg-clip-text text-transparent dark:from-blue-300 dark:to-purple-400">
                                {t("chat.header.welcome", { name: user?.nickname || AsShortName(user?.email as string) })}
                            </span>
                        </h1>
                        <p className="text-xs font-medium text-success">{t("chat.header.selectChat")}</p>
                    </div>
                )}
            </div>

            <button
                type="button"
                onClick={() => setMobileUsersSidebarOpen(true)}
                aria-label={t("chat.header.openPeople")}
                className={`order-3 md:order-last xl:hidden ${ICON_BUTTON}`}
            >
                <HiUsers color="rgb(152, 65, 249)" size={24} aria-hidden="true" />
            </button>

            {roomParticipants && (
                <>
                    {/* Phone-only line break: everything after it starts row 2. */}
                    <div className="order-4 basis-full md:hidden" aria-hidden="true" />

                    {/* flex-1 basis-0 on phones lets the label wrap inside
                        its own box next to the buttons instead of pushing
                        them onto a third row on a narrow screen. The visible
                        text says what it is - no tooltip to rely on. */}
                    {disappearingLabel && (
                        <div className="order-5 flex min-h-11 min-w-0 flex-1 basis-0 items-center md:min-h-0 md:flex-none md:basis-auto">
                            <span className="inline-flex min-w-0 items-start gap-1 rounded-xl bg-purple-50 px-2.5 py-1 text-xs font-medium leading-4 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                <Timer size={14} aria-hidden="true" className="mt-px shrink-0" />
                                <span className="wrap-break-word">{t("chat.header.disappearing", { duration: disappearingLabel })}</span>
                            </span>
                        </div>
                    )}

                    <div className="order-6 ms-auto flex shrink-0 items-center gap-1">
                        {canCall && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => onStartCall(false)}
                                    disabled={!!voiceUnavailable}
                                    aria-label={voiceUnavailable ? t("chat.header.cantVoiceCall", { name: callTargetName, reason: voiceUnavailable }) : t("chat.header.startVoiceCall", { name: callTargetName })}
                                    title={voiceUnavailable || t("chat.header.voiceCall")}
                                    className={ICON_BUTTON}
                                >
                                    <Phone size={22} aria-hidden="true" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onStartCall(true)}
                                    disabled={!!videoUnavailable}
                                    aria-label={videoUnavailable ? t("chat.header.cantVideoCall", { name: callTargetName, reason: videoUnavailable }) : t("chat.header.startVideoCall", { name: callTargetName })}
                                    title={videoUnavailable || t("chat.header.videoCall")}
                                    className={ICON_BUTTON}
                                >
                                    <Video size={22} aria-hidden="true" />
                                </button>
                            </>
                        )}

                        <ChatDropdown
                            handleLeaveRoom={handleLeaveRoom}
                            chat={chat}
                            setChat={setChat}
                            conversationId={conversationId}
                            ensureConversationId={ensureConversationId}
                            participants={participants}
                            updateConversationsBar={updateConversationsBar}
                            onDisappearingMessagesChange={setDisappearingSeconds}
                            setPendingClear={setPendingClear} />
                    </div>
                </>
            )}
        </div>
    );
};
export default ChatHeader;
