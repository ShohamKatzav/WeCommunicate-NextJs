"use client";
import './globals.css'
import { useEffect, useState } from 'react'
import { Inter } from 'next/font/google'
import ErrorClient from './error-client'
import ThemeProvider from './context/themeProvider'
import { I18nProvider, useT } from './i18n/client'
import { withFallback } from './i18n/core'
import { DEFAULT_LOCALE, isLocale, Locale, LOCALE_COOKIE, localeDir, localeFromAcceptLanguage } from './i18n/config'
import type { Messages } from './i18n/messages'
import en from './i18n/en'

const inter = Inter({ subsets: ['latin', 'cyrillic'] })

// This page replaces the root layout, so the server never chose a catalog
// for it. Only the one the visitor needs is fetched, and only once the app
// has actually crashed.
const LOADERS: Record<Exclude<Locale, 'en'>, () => Promise<{ default: Messages }>> = {
    he: () => import('./i18n/he'),
    ar: () => import('./i18n/ar'),
    ru: () => import('./i18n/ru'),
    fr: () => import('./i18n/fr'),
};

// The same choice the layout makes: the cookie, then the browser's languages.
const readLocale = (): Locale => {
    const fromCookie = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]+)`))?.[1];
    if (isLocale(fromCookie)) return fromCookie;
    return localeFromAcceptLanguage(navigator.languages.join(','));
};

// Titled here, not with a metadata export: a client component can't export one.
const Title = () => <title>{useT()('errorPages.errorMetaTitle')}</title>;

export default function GlobalError() {
    const [catalog, setCatalog] = useState<{ locale: Locale; messages: Messages }>({ locale: DEFAULT_LOCALE, messages: en });

    useEffect(() => {
        const locale = readLocale();
        if (locale === 'en') return;
        LOADERS[locale]()
            .then(module => setCatalog({ locale, messages: withFallback(en, module.default) }))
            .catch(() => { });
    }, []);

    return (
        // This replaces the whole root layout on a top-level render error, so
        // it has its own <html> instead of the app's - the dark: classes in
        // ErrorClient were already correct, but nothing here was ever adding
        // the .dark class next-themes uses, so they never activated.
        // suppressHydrationWarning for the same reason layout.tsx has it:
        // next-themes' blocking script sets that class before hydration.
        <html lang={catalog.locale} dir={localeDir(catalog.locale)} className={inter.className} suppressHydrationWarning>
            <body>
                <I18nProvider locale={catalog.locale} messages={catalog.messages}>
                    <Title />
                    <ThemeProvider>
                        <ErrorClient />
                    </ThemeProvider>
                </I18nProvider>
            </body>
        </html>
    );
}
