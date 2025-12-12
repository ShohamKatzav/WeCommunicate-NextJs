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
                    <div className="mt-10">{children}</div>
                    <div className="h-1/5 mb-20"></div>
                </NotificationProvider>
            </SocketProvider>
            <Footer />
        </UserProvider>
    );
}