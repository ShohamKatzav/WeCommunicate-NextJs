"use client";
import React from 'react';
import Navbar from '@/app/components/navbar';
import Footer from '@/app/components/footer';
import { UserProvider } from '@/app/context/userProvider';
import { SocketProvider } from '@/app/context/socketProvider';
import { NotificationProvider } from '@/app/context/notificationProvider';
import { ReloadConversationsBarProvider } from '@/app/context/reloadConversationsBarProvider'

export default function ClientProviders({ children }: { children: React.ReactNode }) {
    return (
        <UserProvider>
            <SocketProvider>
                <Navbar />
                <NotificationProvider>
                    <ReloadConversationsBarProvider>
                        <div className="mt-10">{children}</div>
                        <div className="h-1/5 mb-20"></div>
                    </ReloadConversationsBarProvider>
                </NotificationProvider>
            </SocketProvider>
            <Footer />
        </UserProvider>
    );
}