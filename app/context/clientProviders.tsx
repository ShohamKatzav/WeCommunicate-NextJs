"use client";
import React from 'react';
import Navbar from '@/app/components/navbar';
import Footer from '@/app/components/footer';
import { UserProvider } from '@/app/context/userProvider';
import { SocketProvider } from '@/app/context/socketProvider';
import { NotificationProvider } from '@/app/context/notificationProvider';
import { Toaster } from "sonner";

export default function ClientProviders({ children }: { children: React.ReactNode }) {

    return (
        <UserProvider>
            <SocketProvider>
                <Navbar />
                <NotificationProvider>
                    <Toaster richColors position="top-center" />
                    {/* No padding-top: clearing the fixed navbar is the job of
                        --content-top-offset (app/globals.css), and having a
                        second spacer here is what made the reserved space add
                        up to more than twice the navbar's height. .page-shell
                        (bars.css) fills the leftover viewport; the footer
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