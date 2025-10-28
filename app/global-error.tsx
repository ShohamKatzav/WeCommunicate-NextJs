"use client";
import './globals.css'
import { Inter } from 'next/font/google'
import ErrorClient from './error-client'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
    title: '500 - Page Not Found',
    description: 'Internal Error.',
}

export default function GlobalError() {
    return (
        <html lang="en" className={inter.className}>
            <body>
                <ErrorClient />
            </body>
        </html>
    );
}