"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "../hooks/useUser";
import { getMyProfile } from "../lib/profileActions";
import ProfileCard from "../components/profile/profileCard";
import Loading from "../components/ui/loading";
import Profile from "@/types/profile";
import { useT } from "../i18n/client";

export default function ProfilePage() {
    const { user, loadingUser } = useUser();
    const t = useT();
    const router = useRouter();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);

    // `user?.token` - not `user?.email` - is the actual "am I logged in"
    // signal: a session stays valid even for an account whose `email` field
    // is missing (e.g. a phone sign-up account edited directly in the DB).
    // Gating on email here previously bounced a still-logged-in user to
    // /login, which proxy.ts's own redirect then sent straight to /chat.
    useEffect(() => {
        if (!loadingUser && !user?.token) {
            router.push("/login");
        }
    }, [loadingUser, user?.token, router]);

    useEffect(() => {
        if (loadingUser || !user?.token) return;

        let cancelled = false;
        (async () => {
            const result = await getMyProfile();
            if (!cancelled) {
                setProfile(result.success ? result.profile : null);
                setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [loadingUser, user?.token]);

    if (loadingUser || loading) {
        return <Loading />;
    }

    if (!profile) {
        return (
            <div className="max-w-md mx-auto px-4 pt-4 pb-8 text-center text-muted-foreground">
                {t("profile.loadFailed")}
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto px-4 pt-4 pb-8">
            <ProfileCard profile={profile} isOwn />
        </div>
    );
}
