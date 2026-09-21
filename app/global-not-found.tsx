import './globals.css'
import { Inter } from 'next/font/google'
import NotFoundClient from './not-found-client'
import ThemeProvider from './context/themeProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
    title: '404 - Page Not Found',
    description: 'The page you are looking for does not exist.',
}

export default function GlobalNotFound() {
    return (
        // Own <html> instead of the app's (see global-error.tsx's comment) -
        // NotFoundClient's dark: classes were already correct, but nothing
        // was ever adding the .dark class they key off. suppressHydrationWarning
        // for the same reason layout.tsx has it: next-themes' blocking script
        // sets that class before hydration.
        <html lang="en" className={inter.className} suppressHydrationWarning>
            <body>
                <ThemeProvider>
                    <NotFoundClient />
                </ThemeProvider>
            </body>
        </html>
    );
}