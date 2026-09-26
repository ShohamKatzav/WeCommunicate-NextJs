"use client";

import { useOptimistic, useTransition } from "react";
import { Globe } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "../../i18n/client";
import { isLocale, LOCALES, LOCALE_NAMES } from "../../i18n/config";
import { setMyLocale } from "../../lib/cookieActions";

// The one place a signed-out visitor can change language - otherwise it only
// ever comes from their browser's Accept-Language. The select shows the new
// choice straight away while the page re-renders around it in that language.
const LanguagePicker = () => {
    const { t, locale } = useI18n();
    const [shown, setShown] = useOptimistic(locale);
    const [pending, startTransition] = useTransition();

    return (
        <label className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border/40 bg-foreground/5 ps-2 pe-1 transition-colors hover:border-border hover:text-foreground focus-within:ring-2 focus-within:ring-primary">
            <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {/* Each language named in itself, so whoever is stuck in the
                wrong one can still find theirs. */}
            <select
                aria-label={t("footer.language")}
                value={shown}
                disabled={pending}
                onChange={ev => {
                    const next = ev.target.value;
                    if (!isLocale(next) || next === locale) return;
                    startTransition(async () => {
                        setShown(next);
                        try {
                            await setMyLocale(next);
                        } catch {
                            // Server actions throw offline (the service worker
                            // 503s them) - nothing switched, so say so.
                            toast.info(t("footer.languageOffline"));
                        }
                    });
                }}
                className="cursor-pointer bg-transparent py-1 text-xs text-inherit outline-none disabled:cursor-wait disabled:opacity-60"
            >
                {LOCALES.map(code => (
                    <option key={code} value={code} lang={code} className="bg-card text-card-foreground">
                        {LOCALE_NAMES[code]}
                    </option>
                ))}
            </select>
        </label>
    );
};

export default LanguagePicker;
