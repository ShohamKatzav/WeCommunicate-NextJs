"use client"
import Image from "next/image";
import { useState } from "react";
import { UserX } from "lucide-react";
import { AsShortName } from "../../utils/stringFormat";
import { useT } from "../../i18n/client";

interface AvatarProps {
    avatarUrl?: string;
    nickname?: string;
    email?: string;
    size?: number;
    className?: string;
    // Told when the stored picture fails to load (its file is gone), for a
    // caller that shows controls for the picture - see profile/edit.
    onLoadError?: (url: string) => void;
    // A deleted account: no picture or initial left, just a neutral mark.
    deleted?: boolean;
}

// Single source of truth for "picture, or initials-in-a-gradient-circle" -
// previously duplicated (with slightly different gradients) across userRow,
// conversationSummary and conversationDetailsModal. An account with no
// picture still takes the initials path immediately. A stored URL whose
// file is gone (the blob 404s) lands on that same circle after the image
// fails, instead of a broken image or wrapped alt text.
const Avatar = ({ avatarUrl, nickname, email, size = 40, className = "", onLoadError, deleted = false }: AvatarProps) => {
    const t = useT();
    const displayName = nickname || AsShortName(email);
    const initial = (displayName || "U").charAt(0).toUpperCase();
    // Remember which URL failed. A later picture (a different URL) is tried
    // again; the no-picture case never reaches the image at all.
    const [failedUrl, setFailedUrl] = useState<string | null>(null);

    if (deleted) {
        return (
            <div
                style={{ width: size, height: size }}
                className={`rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-200 shrink-0 ${className}`}
                aria-hidden="true"
            >
                <UserX style={{ width: Math.round(size * 0.5), height: Math.round(size * 0.5) }} />
            </div>
        );
    }

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
            alt={displayName ? t("profile.avatarAlt", { name: displayName }) : t("profile.avatarAltFallback")}
            width={size}
            height={size}
            // Tailwind's preflight sets `height: auto` on images, which
            // drops the height attribute. A failed load then wraps the
            // alt text down a 28px-wide column and stretches the row.
            style={{ width: size, height: size }}
            className={`rounded-full object-cover shrink-0 ${className}`}
            onError={() => {
                setFailedUrl(avatarUrl);
                onLoadError?.(avatarUrl);
            }}
        />
    );
};

export default Avatar;
