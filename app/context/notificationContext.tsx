"use client"
import { createContext } from 'react';
import Message from '../types/message';

type NotificationContextType = {
    newMessageNotification: Record<string, number>;
    setNewMessageNotification: (newNotification: Record<string, number>) => void;
    initializeRoomNotifications: (roomID: string) => void;
    increaseNotifications: (roomID: string) => void;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);
export default NotificationContext;