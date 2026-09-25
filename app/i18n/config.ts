// The UI languages. Adding one is a new catalog file with the same keys as
// en.ts plus an entry in each map below - no schema change: the account
// stores whichever of these codes the user picked (see models/Account.ts).
export const LOCALES = ["en", "he", "ar", "ru", "fr"] as const;
export type Locale = typeof LOCALES[number];

export const DEFAULT_LOCALE: Locale = "en";

// The anonymous choice, and a copy of the account's once signed in (login
// and profile save both write it - see cookieActions.ts/profileActions.ts).
export const LOCALE_COOKIE = "locale";
export const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const isLocale = (value: unknown): value is Locale =>
    typeof value === "string" && (LOCALES as readonly string[]).includes(value);

const RTL_LOCALES: ReadonlySet<Locale> = new Set(["he", "ar"]);
export const localeDir = (locale: Locale): "rtl" | "ltr" => RTL_LOCALES.has(locale) ? "rtl" : "ltr";

// What Intl gets for weekday names, numeric dates and times.
export const DATE_LOCALES: Record<Locale, string> = {
    en: "en-US",
    he: "he-IL",
    ar: "ar",
    ru: "ru-RU",
    fr: "fr-FR",
};

// Each language named in itself, so the picker is readable whatever the UI is in.
export const LOCALE_NAMES: Record<Locale, string> = {
    en: "English",
    he: "עברית",
    ar: "العربية",
    ru: "Русский",
    fr: "Français",
};

// The browser's preferred languages, best first, mapped onto ours. "iw" is
// the pre-1989 code for Hebrew that some older Android builds still send.
// English counts as a match too, so "en-US,he;q=0.9" stays English rather
// than jumping to the first non-English language listed.
export const localeFromAcceptLanguage = (header: string | null | undefined): Locale => {
    if (!header) return DEFAULT_LOCALE;
    const ranked = header
        .split(",")
        .map((part, index) => {
            const [tag, ...params] = part.trim().split(";");
            const q = params.map(p => p.trim()).find(p => p.startsWith("q="));
            const weight = q ? Number(q.slice(2)) : 1;
            return { tag: tag.trim().toLowerCase(), weight: Number.isFinite(weight) ? weight : 0, index };
        })
        .filter(entry => entry.tag && entry.weight > 0)
        .sort((a, b) => b.weight - a.weight || a.index - b.index);

    for (const { tag } of ranked) {
        const primary = tag.split("-")[0];
        const code = primary === "iw" ? "he" : primary;
        if (isLocale(code)) return code;
    }
    return DEFAULT_LOCALE;
};
