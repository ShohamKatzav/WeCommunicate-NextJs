"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "../../hooks/useUser";
import { getProfile } from "../../lib/profileActions";
import ProfileCard from "../../components/profile/profileCard";
import Loading from "../../components/ui/loading";
import Profile from "@/types/profile";
import { useT } from "../../i18n/client";

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

    if (notFound || !profile) {
        return (
            <div className="max-w-md mx-auto px-4 py-8 text-center text-muted-foreground">
                {t("profile.userNotFound")}
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto px-4 py-8">
            <ProfileCard profile={profile} />
        </div>
    );
}
