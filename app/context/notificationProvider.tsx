"use client"
import { useState, useEffect, ReactNode } from 'react';
import { useSocket } from '../hooks/useSocket';
import NotificationContext from './notificationContext';

type NotificationProviderProps = {
    children: ReactNode;
};

export const NotificationProvider = ({ children }: NotificationProviderProps) => {

    const [newMessageNotification, setNewMessageNotification] = useState<Record<string, number>>({});
    const { socket, loadingSocket } = useSocket();

    // GET
    useEffect(() => {
        if (!loadingSocket) {
            const FetchNotifications = async () => {
                socket?.on("notifications update", notificationsUpdate);
                await socket?.emit("notifications update");
            };
            FetchNotifications();
            return () => {
                socket?.off("notifications update", notificationsUpdate);
            };
        }
    }, [socket, loadingSocket]);

    // SET
    useEffect(() => {
        if (Object.keys(newMessageNotification).length > 0) {
            socket?.emit("update notifications count", newMessageNotification);
        }
    }, [newMessageNotification, socket]);

    // DEL
    const initializeRoomNotifications = async (roomID: string) => {
        await socket?.emit("notifications checked", roomID);
        setNewMessageNotification(prevState => ({
            ...prevState,
            [roomID]: 0,
        }));
    };

    const increaseNotifications = (roomID: string) => {
        if (roomID) {
            setNewMessageNotification(prevState => ({
                ...prevState,
                [roomID]: (prevState[roomID] || 0) + 1,
            }));
        }
    };

    const notificationsUpdate = (data: Record<string, number>) => {
        if (data) {
            const updatedNotifications: Record<string, number> = {};
            for (const [roomID, count] of Object.entries(data)) {
                updatedNotifications[roomID] = Number(count);
            }
            setNewMessageNotification(() => updatedNotifications); // Replace state completely
        }
    };

    return (
        <NotificationContext.Provider
            value={{
                newMessageNotification,
                setNewMessageNotification,
                initializeRoomNotifications,
                increaseNotifications
            }}
        >
            {children}
        </NotificationContext.Provider>
    );
};

