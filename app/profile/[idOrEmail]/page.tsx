"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useUser } from "../../hooks/useUser";
import { getProfile } from "../../lib/profileActions";
import ProfileCard from "../../components/profile/profileCard";
import Loading from "../../components/ui/loading";
import Profile from "@/types/profile";
import { useT } from "../../i18n/client";
import { armChatReturn } from "../../utils/chatReturn";

export default function OtherUserProfilePage() {
    const params = useParams<{ idOrEmail: string }>();
    const idOrEmail = params?.idOrEmail;
    const { user, loadingUser } = useUser();
    const t = useT();
    const router = useRouter();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    // `user?.token` - not `user?.email` - is the actual "am I logged in"
    // signal: a session stays valid even for an account whose `email` field
    // is missing (e.g. a phone sign-up account edited directly in the DB).
    useEffect(() => {
        if (!loadingUser && !user?.token) {
            router.push("/login");
        }
    }, [loadingUser, user?.token, router]);

    useEffect(() => {
        if (loadingUser || !user?.token || !idOrEmail) return;

        let cancelled = false;
        (async () => {
            const result = await getProfile(idOrEmail);
            if (cancelled) return;

            if (!result.success) {
                setNotFound(true);
                setLoading(false);
                return;
            }

            // Own profile has its own (editable) view - don't show a
            // read-only duplicate of it here. Computed server-side (see
            // getProfile) from the caller's own id, not an email
            // comparison - the caller's email can be missing entirely.
            if (result.isOwn) {
                router.replace("/profile");
                return;
            }

            setProfile(result.profile);
            setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [loadingUser, user?.token, idOrEmail, router]);

    if (loadingUser || loading) {
        return <Loading />;
    }

    // Back to /chat with the conversation that was open when this profile
    // was opened from it, if any - see utils/chatReturn.ts. A plain link,
    // so it also works as "Chat" for a profile reached some other way.
    // The chevron points at the start edge, so it flips in RTL.
    const backToChat = (
        <Link
            href="/chat"
            onClick={() => { if (idOrEmail) armChatReturn(idOrEmail); }}
            className="-ms-2 mb-4 flex w-fit items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
            <ChevronLeft className="h-4 w-4 shrink-0 rtl:rotate-180" aria-hidden="true" />
            {t("profile.backToChat")}
        </Link>
    );

    if (notFound || !profile) {
        return (
            <div className="max-w-md mx-auto px-4 py-8">
                {backToChat}
                <p className="text-center text-muted-foreground">
                    {t("profile.userNotFound")}
                </p>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto px-4 py-8">
            {backToChat}
            <ProfileCard profile={profile} />
        </div>
    );
}
