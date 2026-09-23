"use client";
import React from 'react';
import { useTheme } from 'next-themes';
import Navbar from '@/app/components/shell/navbar';
import Footer from '@/app/components/shell/footer';
import { UserProvider } from '@/app/context/userProvider';
import { SocketProvider } from '@/app/context/socketProvider';
import { NotificationProvider } from '@/app/context/notificationProvider';
import { Toaster } from "sonner";

export default function ClientProviders({ children }: { children: React.ReactNode }) {
    // "system" (the default before mount) is a valid value Toaster already
    // understands on its own, so this needs no mounted-guard the way
    // ThemeToggle's icon does - there's no visible flash to avoid here.
    const { theme } = useTheme();

    return (
        <UserProvider>
            <SocketProvider>
                <Navbar />
                <NotificationProvider>
                    <Toaster richColors position="top-center" theme={theme as 'light' | 'dark' | 'system' | undefined} />
                    {/* No padding-top: clearing the fixed navbar is the job of
                        --content-top-offset (app/globals.css), and having a
                        second spacer here is what made the reserved space add
                        up to more than twice the navbar's height. .page-shell
                        (app/components/shell/bars.css) fills the leftover viewport; the footer
                        then uses margin-top: auto so short pages still park
                        it on the bottom edge. */}
                    <div className="page-shell">
                        <div>{children}</div>
                        <Footer />
                    </div>
                </NotificationProvider>
            </SocketProvider>
        </UserProvider>
    );
}