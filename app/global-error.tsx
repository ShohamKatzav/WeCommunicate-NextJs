"use client";
import './globals.css'
import { Inter } from 'next/font/google'
import ErrorClient from './error-client'
import ThemeProvider from './context/themeProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
    title: '500 - Page Not Found',
    description: 'Internal Error.',
}

export default function GlobalError() {
    return (
        // This replaces the whole root layout on a top-level render error, so
        // it has its own <html> instead of the app's - the dark: classes in
        // ErrorClient were already correct, but nothing here was ever adding
        // the .dark class next-themes uses, so they never activated.
        // suppressHydrationWarning for the same reason layout.tsx has it:
        // next-themes' blocking script sets that class before hydration.
        <html lang="en" className={inter.className} suppressHydrationWarning>
            <body>
                <ThemeProvider>
                    <ErrorClient />
                </ThemeProvider>
            </body>
        </html>
    );
}