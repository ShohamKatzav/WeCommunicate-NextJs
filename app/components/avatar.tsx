import Image from "next/image";
import { AsShortName } from "../utils/stringFormat";

interface AvatarProps {
    avatarUrl?: string;
    nickname?: string;
    email?: string;
    size?: number;
    className?: string;
}

// Single source of truth for "picture, or initials-in-a-gradient-circle" -
// previously duplicated (with slightly different gradients) across userRow,
// conversationSummary and conversationDetailsModal.
const Avatar = ({ avatarUrl, nickname, email, size = 40, className = "" }: AvatarProps) => {
    const displayName = nickname || AsShortName(email);
    const initial = (displayName || "U").charAt(0).toUpperCase();

    if (avatarUrl) {
        return (
            <Image
                src={avatarUrl}
                alt={displayName ? `${displayName}'s avatar` : "User avatar"}
                width={size}
                height={size}
                className={`rounded-full object-cover shrink-0 ${className}`}
            />
        );
    }

    return (
        <div
            style={{ width: size, height: size, fontSize: Math.max(12, Math.round(size * 0.4)) }}
            className={`rounded-full bg-linear-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white font-semibold shrink-0 ${className}`}
            aria-hidden="true"
        >
            {initial}
        </div>
    );
};

export default Avatar;
