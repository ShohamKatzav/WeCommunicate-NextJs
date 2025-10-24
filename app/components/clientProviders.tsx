"use client";

import React from 'react';
import Navbar from './navbar';
import Footer from './footer';
import { UserProvider } from '../context/userProvider';
import { SocketProvider } from '../context/socketProvider';
import { NotificationProvider } from '../context/notificationProvider';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
    return (
        <UserProvider>
            <SocketProvider>
                <Navbar />
                <NotificationProvider>
                    <div className="mt-10">{children}</div>
                    <div className="h-1/5 mb-20"></div>
                </NotificationProvider>
            </SocketProvider>
            <Footer />
        </UserProvider>
    );
}