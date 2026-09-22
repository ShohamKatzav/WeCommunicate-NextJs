"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { toast } from "sonner";
import { ImageUp, Trash2 } from "lucide-react";
import { useUser } from "../../hooks/useUser";
import { getMyProfile, updateMyProfile, updateMyAvatar } from "../../lib/profileActions";
import { compressImageIfWorthwhile, convertHeicToJpegIfNeeded } from "../../components/uploadFile";
import { isEmail } from "../../lib/contact";
import Avatar from "../../components/avatar";
import AccentColorPicker from "../../components/accentColorPicker";
import PhoneNumberEditor from "../../components/phoneNumberEditor";
import EmailAddressEditor from "../../components/emailAddressEditor";
import AvatarCameraCapture from "../../components/avatarCameraCapture";
import ImageCropper from "../../components/imageCropper";
import Loading from "../../components/loading";
import { ABOUT_MAX_LENGTH, DEFAULT_ACCENT_COLOR } from "../../config/limits";

const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
const AVATAR_MAX_SIZE = 10 * 1024 * 1024;

export default function EditProfilePage() {
    const { user, loadingUser, updateUser } = useUser();
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [loading, setLoading] = useState(true);
    const [nickname, setNickname] = useState("");
    const [about, setAbout] = useState("");
    const [accentColor, setAccentColor] = useState<string>(DEFAULT_ACCENT_COLOR);
    const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
    const [phone, setPhone] = useState<string | undefined>(undefined);
    const [email, setEmail] = useState<string | undefined>(undefined);
    // False for a phone sign-up account whose `email` is really the
    // synthetic `phone:...` key (see createUser in accountActions.ts) - that
    // key must never be shown or treated as a real address.
    const [hasRealEmail, setHasRealEmail] = useState(false);
    // Phone changes are only offered when the account has a real email to
    // verify the request against - see PhoneNumberEditor.tsx. Becomes true
    // on the next load of this page once the account gains a real email.
    const [canEditPhone, setCanEditPhone] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    // Set once a picked or captured photo has passed validation and is
    // waiting on the crop step - clearing it (Skip or Cancel) is what
    // decides whether the original or the cropped square gets uploaded.
    const [fileToCrop, setFileToCrop] = useState<File | null>(null);

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
            if (cancelled) return;
            if (result.success) {
                setNickname(result.profile.nickname || "");
                setAbout(result.profile.about || "");
                setAccentColor(result.profile.accentColor || DEFAULT_ACCENT_COLOR);
                setAvatarUrl(result.profile.avatarUrl);
                setPhone(result.profile.phone);
                const realEmail = isEmail(result.profile.email);
                setHasRealEmail(realEmail);
                setEmail(realEmail ? result.profile.email : undefined);
                setCanEditPhone(realEmail);
            }
            setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [loadingUser, user?.token]);

    // Validation runs before the crop, not after it: a file that was never
    // going to be accepted shouldn't first make the user frame it.
    const prepareAvatarFile = async (rawFile: File) => {
        if (!user?.token) return null;

        let file = rawFile;
        if (!file.type || file.type === "image/heic" || file.type === "image/heif") {
            try {
                file = await convertHeicToJpegIfNeeded(file);
            } catch (err) {
                console.error("HEIC conversion failed:", err);
                toast.error("Please choose a JPG, PNG, or WEBP image");
                return null;
            }
        }

        if (!AVATAR_TYPES.includes(file.type)) {
            toast.error("Please choose a JPG, PNG, or WEBP image");
            return null;
        }
        if (file.size > AVATAR_MAX_SIZE) {
            toast.error("Image must be smaller than 10MB");
            return null;
        }

        return file;
    };

    const offerCrop = async (rawFile: File) => {
        const prepared = await prepareAvatarFile(rawFile);
        if (prepared) setFileToCrop(prepared);
    };

    const uploadAvatarFile = async (file: File) => {
        if (!user?.token) return;

        setFileToCrop(null);
        setUploadingAvatar(true);
        try {
            const compressed = await compressImageIfWorthwhile(file);

            const blob = await upload(compressed.name, compressed, {
                access: "public",
                handleUploadUrl: "/api/send-file",
                headers: {
                    // Unused by /api/send-file (it only checks the Bearer
                    // token), and user.email can genuinely be absent - so
                    // this is never asserted non-null.
                    email: user.email || "",
                    authorization: `Bearer ${user.token}`
                }
            });

            const result = await updateMyAvatar(blob.url);
            if (result.success) {
                setAvatarUrl(blob.url);
                await updateUser({ ...user, avatarUrl: blob.url });
                toast.success("Avatar updated");
            } else {
                toast.error(result.error || "Failed to update avatar");
            }
        } catch (err) {
            console.error("Avatar upload failed:", err);
            toast.error("Failed to upload avatar");
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleAvatarChange = () => {
        const file = fileInputRef.current?.files?.[0];
        if (fileInputRef.current) fileInputRef.current.value = "";
        if (file) void offerCrop(file);
    };

    const handleRemoveAvatar = async () => {
        if (!avatarUrl) return;
        setUploadingAvatar(true);
        try {
            const result = await updateMyAvatar(null);
            if (result.success) {
                setAvatarUrl(undefined);
                await updateUser({ ...user, avatarUrl: undefined });
                toast.success("Avatar removed");
            } else {
                toast.error(result.error || "Failed to remove avatar");
            }
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleEmailChanged = async (newEmail: string, newToken: string) => {
        setEmail(newEmail);
        setHasRealEmail(true);
        // SocketProvider reconnects when user.token/email change, and socket
        // auth reads email from the JWT (not the handshake header) - so both
        // must be replaced together with the reissued token.
        await updateUser({ ...user, email: newEmail, token: newToken });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const result = await updateMyProfile({ nickname, about, accentColor });
            if (result.success) {
                await updateUser({ ...user, nickname: result.profile.nickname, accentColor: result.profile.accentColor });
                toast.success("Profile updated");
                router.push("/profile");
            } else {
                toast.error(result.error || "Failed to update profile");
            }
        } catch {
            toast.info("You're offline - this couldn't be saved right now.");
        } finally {
            setSaving(false);
        }
    };

    if (loadingUser || loading) {
        return <Loading />;
    }

    return (
        <div className="max-w-md mx-auto px-4 py-8">
            {fileToCrop && (
                <ImageCropper
                    file={fileToCrop}
                    busy={uploadingAvatar}
                    onCropped={(cropped) => void uploadAvatarFile(cropped)}
                    onSkip={() => void uploadAvatarFile(fileToCrop)}
                    onCancel={() => setFileToCrop(null)}
                />
            )}
            <div className="bg-card text-card-foreground rounded-xl shadow-md p-6">
                <h1 className="text-xl font-semibold mb-6 text-center">Edit profile</h1>

                <div className="flex flex-col items-center gap-3 mb-6">
                    <div className="relative">
                        <Avatar avatarUrl={avatarUrl} nickname={nickname} email={user?.email} size={96} />
                        <label
                            htmlFor="avatar-upload"
                            className="absolute bottom-0 right-0 p-1.5 rounded-full bg-primary text-primary-foreground cursor-pointer hover:opacity-90"
                            aria-label="Change avatar"
                        >
                            <ImageUp size={16} />
                        </label>
                        <input
                            id="avatar-upload"
                            ref={fileInputRef}
                            type="file"
                            accept={AVATAR_TYPES.join(",")}
                            className="hidden"
                            disabled={uploadingAvatar}
                            onChange={handleAvatarChange}
                        />
                        <AvatarCameraCapture
                            onCapture={(file) => void offerCrop(file)}
                            disabled={uploadingAvatar}
                        />
                    </div>
                    {avatarUrl && (
                        <button
                            type="button"
                            onClick={handleRemoveAvatar}
                            disabled={uploadingAvatar}
                            className="flex items-center gap-1 text-xs text-destructive hover:underline disabled:opacity-50"
                        >
                            <Trash2 size={14} /> Remove avatar
                        </button>
                    )}
                </div>

                <div className="space-y-4">
                    <div>
                        <label htmlFor="nickname" className="block text-sm font-medium mb-1">Nickname</label>
                        <input
                            id="nickname"
                            type="text"
                            value={nickname}
                            onChange={ev => setNickname(ev.target.value)}
                            maxLength={40}
                            disabled={saving}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <EmailAddressEditor currentEmail={email} hasRealEmail={hasRealEmail} hasPhone={!!phone} onChanged={handleEmailChanged} />

                    <PhoneNumberEditor currentPhone={phone} canEdit={canEditPhone} onChanged={setPhone} />

                    <div>
                        <label htmlFor="about" className="block text-sm font-medium mb-1">About me</label>
                        <textarea
                            id="about"
                            value={about}
                            onChange={ev => setAbout(ev.target.value.slice(0, ABOUT_MAX_LENGTH))}
                            maxLength={ABOUT_MAX_LENGTH}
                            placeholder="Usually online evenings"
                            disabled={saving}
                            rows={3}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        />
                        <div className="text-xs text-muted-foreground text-right mt-1">
                            {about.length}/{ABOUT_MAX_LENGTH}
                        </div>
                    </div>

                    <div>
                        <span className="block text-sm font-medium mb-1">Accent color</span>
                        <AccentColorPicker value={accentColor} onChange={setAccentColor} />
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <button
                        type="button"
                        onClick={() => router.push("/profile")}
                        disabled={saving}
                        className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || !nickname.trim()}
                        className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>
        </div>
    );
}
