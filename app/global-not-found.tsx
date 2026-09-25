import './globals.css'
import { Inter } from 'next/font/google'
import NotFoundClient from './not-found-client'
import ThemeProvider from './context/themeProvider'
import { I18nProvider } from './i18n/client'
import { getLocale, getT } from './i18n/server'
import { messagesFor } from './i18n/messages'
import { localeDir } from './i18n/config'

const inter = Inter({ subsets: ['latin', 'cyrillic'] })

export async function generateMetadata() {
    const t = await getT();
    return {
        title: t('errorPages.notFoundMetaTitle'),
        description: t('errorPages.notFoundMetaDescription'),
    };
}

export default async function GlobalNotFound() {
    const locale = await getLocale();
    return (
        // Own <html> instead of the app's (see global-error.tsx's comment) -
        // NotFoundClient's dark: classes were already correct, but nothing
        // was ever adding the .dark class they key off. suppressHydrationWarning
        // for the same reason layout.tsx has it: next-themes' blocking script
        // sets that class before hydration.
        <html lang={locale} dir={localeDir(locale)} className={inter.className} suppressHydrationWarning>
            <body>
                <I18nProvider locale={locale} messages={messagesFor(locale)}>
                    <ThemeProvider>
                        <NotFoundClient />
                    </ThemeProvider>
                </I18nProvider>
            </body>
        </html>
    );
}
