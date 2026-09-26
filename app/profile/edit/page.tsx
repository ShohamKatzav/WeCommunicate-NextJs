"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { toast } from "sonner";
import { ImageUp, Trash2 } from "lucide-react";
import { useUser } from "../../hooks/useUser";
import { getMyProfile, updateMyProfile, updateMyAvatar } from "../../lib/profileActions";
import { compressImageIfWorthwhile, convertHeicToJpegIfNeeded } from "../../components/ui/uploadFile";
import { isEmail } from "../../lib/contact";
import Avatar from "../../components/ui/avatar";
import AccentColorPicker from "../../components/profile/accentColorPicker";
import PhoneNumberEditor from "../../components/profile/phoneNumberEditor";
import EmailAddressEditor from "../../components/profile/emailAddressEditor";
import AvatarCameraCapture from "../../components/profile/avatarCameraCapture";
import ImageCropper from "../../components/profile/imageCropper";
import DeleteAccountSection from "../../components/profile/deleteAccountSection";
import Loading from "../../components/ui/loading";
import { ABOUT_MAX_LENGTH, DEFAULT_ACCENT_COLOR } from "../../config/limits";
import { useI18n } from "../../i18n/client";
import { isLocale, Locale, LOCALES, LOCALE_NAMES } from "../../i18n/config";

const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
const AVATAR_MAX_SIZE = 10 * 1024 * 1024;
const labelClassName = "mb-0.5 block text-sm font-medium sm:mb-1";
const fieldClassName = "w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white sm:px-4 sm:py-2";

export default function EditProfilePage() {
    const { user, loadingUser, updateUser } = useUser();
    const { t, locale: activeLocale, dir: pageDir } = useI18n();
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [loading, setLoading] = useState(true);
    const [nickname, setNickname] = useState("");
    const [about, setAbout] = useState("");
    const [accentColor, setAccentColor] = useState<string>(DEFAULT_ACCENT_COLOR);
    // An account that never picked a language shows the one this page is
    // already in, so saving without touching it doesn't switch anything.
    const [locale, setLocale] = useState<Locale>(activeLocale);
    const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
    // A stored picture whose file is gone shows as initials (see Avatar), so
    // there's nothing to remove - only a picture that actually loads gets
    // the Remove button. Kept per URL, so a new upload is judged afresh.
    const [brokenAvatarUrl, setBrokenAvatarUrl] = useState<string | null>(null);
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
                if (isLocale(result.profile.locale)) setLocale(result.profile.locale);
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
                toast.error(t("profile.edit.avatarType"));
                return null;
            }
        }

        if (!AVATAR_TYPES.includes(file.type)) {
            toast.error(t("profile.edit.avatarType"));
            return null;
        }
        if (file.size > AVATAR_MAX_SIZE) {
            toast.error(t("profile.edit.avatarSize"));
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
                toast.success(t("profile.edit.avatarUpdated"));
            } else {
                toast.error(result.error || t("profile.edit.avatarUpdateFailed"));
            }
        } catch (err) {
            console.error("Avatar upload failed:", err);
            toast.error(t("profile.edit.avatarUploadFailed"));
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
                toast.success(t("profile.edit.avatarRemoved"));
            } else {
                toast.error(result.error || t("profile.edit.avatarRemoveFailed"));
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
            const result = await updateMyProfile({ nickname, about, accentColor, locale });
            if (result.success) {
                await updateUser({ ...user, nickname: result.profile.nickname, accentColor: result.profile.accentColor, locale: result.profile.locale });
                // From the server, in the language just saved - this
                // handler's own t is still the one from before the switch.
                toast.success(result.message);
                router.push("/profile");
            } else {
                toast.error(result.error || t("profile.edit.updateFailed"));
            }
        } catch {
            toast.info(t("profile.edit.offline"));
        } finally {
            setSaving(false);
        }
    };

    if (loadingUser || loading) {
        return <Loading />;
    }

    return (
        // Tight on a phone: the navbar already clears the top, and this card
        // has to finish inside the first screen. sm: restores a little air
        // once the window is tall enough that the extra padding is free.
        <div className="mx-auto max-w-md px-3 pt-2 pb-4 sm:px-4 sm:pt-4 sm:pb-8">
            {fileToCrop && (
                <ImageCropper
                    file={fileToCrop}
                    busy={uploadingAvatar}
                    onCropped={(cropped) => void uploadAvatarFile(cropped)}
                    onSkip={() => void uploadAvatarFile(fileToCrop)}
                    onCancel={() => setFileToCrop(null)}
                />
            )}
            <div className="rounded-xl bg-card p-3.5 text-card-foreground shadow-md sm:p-6">
                <div className="mb-3 flex items-center gap-3 sm:mb-5">
                    <div className="relative shrink-0">
                        <Avatar avatarUrl={avatarUrl} nickname={nickname} email={user?.email} size={64} onLoadError={setBrokenAvatarUrl} />
                        <label
                            htmlFor="avatar-upload"
                            className="absolute bottom-0 end-0 cursor-pointer rounded-full bg-primary p-1 text-primary-foreground hover:opacity-90"
                            aria-label={t("profile.edit.changeAvatar")}
                        >
                            <ImageUp size={14} />
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
                    <div className="min-w-0">
                        <h1 className="text-lg font-semibold leading-tight">{t("profile.edit.title")}</h1>
                        {avatarUrl && avatarUrl !== brokenAvatarUrl && (
                            <button
                                type="button"
                                onClick={handleRemoveAvatar}
                                disabled={uploadingAvatar}
                                className="mt-1 flex items-center gap-1 text-xs text-destructive hover:underline disabled:opacity-50"
                            >
                                <Trash2 size={14} /> {t("profile.edit.removeAvatar")}
                            </button>
                        )}
                    </div>
                </div>

                <div className="space-y-2.5 sm:space-y-4">
                    {/* Nickname and language are both short controls that
                        Save writes together, so they share a row instead of
                        each costing a full line of the phone screen. */}
                    <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                        <div className="min-w-0">
                            <label htmlFor="nickname" className={labelClassName}>{t("profile.edit.nickname")}</label>
                            <input
                                id="nickname"
                                type="text"
                                value={nickname}
                                onChange={ev => setNickname(ev.target.value)}
                                maxLength={40}
                                disabled={saving}
                                className={fieldClassName}
                            />
                        </div>
                        <div className="min-w-0">
                            <label htmlFor="locale" className={labelClassName}>{t("profile.edit.language")}</label>
                            {/* Each language named in itself, so whoever is stuck
                                in the wrong one can still find theirs. */}
                            <select
                                id="locale"
                                value={locale}
                                onChange={ev => { if (isLocale(ev.target.value)) setLocale(ev.target.value); }}
                                disabled={saving}
                                className={fieldClassName}
                            >
                                {LOCALES.map(code => (
                                    <option key={code} value={code} lang={code}>{LOCALE_NAMES[code]}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <EmailAddressEditor currentEmail={email} hasRealEmail={hasRealEmail} hasPhone={!!phone} onChanged={handleEmailChanged} />

                    <PhoneNumberEditor currentPhone={phone} canEdit={canEditPhone} onChanged={setPhone} />

                    <div>
                        <div className="mb-0.5 flex items-baseline justify-between gap-2 sm:mb-1">
                            <label htmlFor="about" className="text-sm font-medium">{t("profile.edit.about")}</label>
                            <span className="text-xs text-muted-foreground">{about.length}/{ABOUT_MAX_LENGTH}</span>
                        </div>
                        <textarea
                            id="about"
                            value={about}
                            onChange={ev => setAbout(ev.target.value.slice(0, ABOUT_MAX_LENGTH))}
                            maxLength={ABOUT_MAX_LENGTH}
                            // Typed text takes its direction from its first
                            // letter; empty, the placeholder follows the page -
                            // "auto" with nothing in it would be left to right.
                            dir={about ? "auto" : pageDir}
                            placeholder={t("profile.edit.aboutPlaceholder")}
                            disabled={saving}
                            rows={2}
                            className={`${fieldClassName} resize-none`}
                        />
                    </div>

                    <div>
                        <span className={labelClassName}>{t("profile.edit.accentColor")}</span>
                        <AccentColorPicker value={accentColor} onChange={setAccentColor} />
                    </div>
                </div>

                <div className="mt-3 flex gap-2.5 sm:mt-6 sm:gap-3">
                    <button
                        type="button"
                        onClick={() => router.push("/profile")}
                        disabled={saving}
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                        {t("profile.edit.cancel")}
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || !nickname.trim()}
                        className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {saving ? t("profile.edit.saving") : t("profile.edit.save")}
                    </button>
                </div>

                {/* Separate from Save, and from the avatar's Remove above. */}
                <DeleteAccountSection />
            </div>
        </div>
    );
}
