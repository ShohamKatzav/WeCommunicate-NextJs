import './globals.css'
import { Inter } from 'next/font/google'
import NotFoundClient from './not-found-client'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
    title: '404 - Page Not Found',
    description: 'The page you are looking for does not exist.',
}

export default function GlobalNotFound() {
    return (
        <html lang="en" className={inter.className}>
            <body>
                <NotFoundClient />
            </body>
        </html>
    );
}