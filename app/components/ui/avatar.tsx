"use client"
import Image from "next/image";
import { useState } from "react";
import { AsShortName } from "../../utils/stringFormat";

interface AvatarProps {
    avatarUrl?: string;
    nickname?: string;
    email?: string;
    size?: number;
    className?: string;
}

// Single source of truth for "picture, or initials-in-a-gradient-circle" -
// previously duplicated (with slightly different gradients) across userRow,
// conversationSummary and conversationDetailsModal. An account with no
// picture still takes the initials path immediately. A stored URL whose
// file is gone (the blob 404s) lands on that same circle after the image
// fails, instead of a broken image or wrapped alt text.
const Avatar = ({ avatarUrl, nickname, email, size = 40, className = "" }: AvatarProps) => {
    const displayName = nickname || AsShortName(email);
    const initial = (displayName || "U").charAt(0).toUpperCase();
    // Remember which URL failed. A later picture (a different URL) is tried
    // again; the no-picture case never reaches the image at all.
    const [failedUrl, setFailedUrl] = useState<string | null>(null);

    if (!avatarUrl || failedUrl === avatarUrl) {
        return (
            <div
                style={{ width: size, height: size, fontSize: Math.max(12, Math.round(size * 0.4)) }}
                className={`rounded-full bg-linear-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white font-semibold shrink-0 ${className}`}
                aria-hidden="true"
            >
                {initial}
            </div>
        );
    }

    return (
        <Image
            src={avatarUrl}
            alt={displayName ? `${displayName}'s avatar` : "User avatar"}
            width={size}
            height={size}
            // Tailwind's preflight sets `height: auto` on images, which
            // drops the height attribute. A failed load then wraps the
            // alt text down a 28px-wide column and stretches the row.
            style={{ width: size, height: size }}
            className={`rounded-full object-cover shrink-0 ${className}`}
            onError={() => setFailedUrl(avatarUrl)}
        />
    );
};

export default Avatar;
