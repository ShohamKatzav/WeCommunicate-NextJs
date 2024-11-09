"use client"
import { createContext } from 'react';

type NotificationContextType = {
    newMessageNotification: Record<string, number>;
    setNewMessageNotification: (newNotification: Record<string, number>) => void;
    initializeRoomNotifications: (email: string) => void;
    increaseNotifications: (email: string) => void;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);
export default NotificationContext;