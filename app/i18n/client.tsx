"use client";
import { createContext, ReactNode, useContext, useMemo } from "react";
import { createTranslator, Translator } from "./core";
import { DEFAULT_LOCALE, Locale, localeDir } from "./config";
import type { Messages } from "./messages";
import en from "./en";

type I18nValue = {
    locale: Locale;
    dir: "rtl" | "ltr";
    t: Translator<Messages>;
};

// Outside the provider (only the global error page renders there) the app
// falls back to English rather than throwing.
const I18nContext = createContext<I18nValue>({
    locale: DEFAULT_LOCALE,
    dir: "ltr",
    t: createTranslator(DEFAULT_LOCALE, en),
});

// The root layout resolves the locale and hands over just that one catalog
// (already merged over English), so the other languages never ship to the
// browser. Choosing a language in the profile re-renders the layout with the
// new one - see profileActions.updateMyProfile.
export const I18nProvider = ({ locale, messages, children }: { locale: Locale; messages: Messages; children: ReactNode }) => {
    const value = useMemo(() => ({
        locale,
        dir: localeDir(locale),
        t: createTranslator(locale, messages),
    }), [locale, messages]);
    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => useContext(I18nContext);
export const useT = () => useContext(I18nContext).t;
