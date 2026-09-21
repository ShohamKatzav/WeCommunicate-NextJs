import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import Avatar from "./avatar";
import Profile from "@/types/profile";
import { DEFAULT_ACCENT_COLOR } from "../config/limits";
import { AsShortName } from "../utils/stringFormat";
import { isEmail } from "../lib/contact";

interface ProfileCardProps {
    profile: Profile;
    isOwn?: boolean;
}

const ProfileCard = ({ profile, isOwn }: ProfileCardProps) => {
    const displayName = profile.nickname || AsShortName(profile.email);
    const accentColor = profile.accentColor || DEFAULT_ACCENT_COLOR;

    return (
        <div className="bg-card text-card-foreground rounded-xl shadow-md p-6 max-w-md mx-auto">
            <div className="flex flex-col items-center gap-3 text-center">
                <Avatar avatarUrl={profile.avatarUrl} nickname={profile.nickname} email={profile.email} size={96} />
                <h1 className="text-xl font-semibold" data-testid="profile-nickname">{displayName}</h1>

                {isOwn && profile.phone && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground" data-testid="profile-phone">
                        <Phone size={14} aria-hidden="true" />
                        {profile.phone}
                    </div>
                )}

                {/* A chat participant's profile always shows both rows, even
                    when unset - `email` may be a synthetic `phone:...` signup
                    key rather than a real address (see isEmail/createUser),
                    which must never be rendered as if it were one. */}
                {!isOwn && (
                    <>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground" data-testid="profile-email">
                            <Mail size={14} aria-hidden="true" />
                            {isEmail(profile.email) ? profile.email : <span className="italic">Hasn&apos;t added an email</span>}
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground" data-testid="profile-phone">
                            <Phone size={14} aria-hidden="true" />
                            {profile.phone ? profile.phone : <span className="italic">Hasn&apos;t added a phone number</span>}
                        </div>
                    </>
                )}

                {profile.about ? (
                    <p className="text-sm wrap-break-word" data-testid="profile-about">{profile.about}</p>
                ) : (
                    isOwn && <p className="text-sm text-muted-foreground italic">Add a short line about yourself</p>
                )}

                {/* Accent color only tints the owner's own message bubbles -
                    another viewer always sees a peer's messages in the fixed
                    received-message gray (see messageBubble.tsx), so showing
                    it on someone else's profile would just be noise. */}
                {isOwn && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span
                            className="w-3 h-3 rounded-full border border-border"
                            style={{ backgroundColor: accentColor }}
                            aria-hidden="true"
                            data-testid="profile-accent-swatch"
                        />
                        Accent color
                    </div>
                )}

                {isOwn && (
                    <Link
                        href="/profile/edit"
                        className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-colors"
                    >
                        Edit profile
                    </Link>
                )}
            </div>
        </div>
    );
};

export default ProfileCard;
