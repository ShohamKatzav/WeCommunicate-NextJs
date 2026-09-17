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
                    <div className="pt-16 pb-24 md:pt-8 md:pb-20 min-h-0">{children}</div>
                </NotificationProvider>
            </SocketProvider>
            <Footer />
        </UserProvider>
    );
}