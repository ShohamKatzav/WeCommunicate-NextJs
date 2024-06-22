"use client"
import { createContext } from 'react';
import { Socket } from 'socket.io-client';

type SocketContextType = {
  socket: Socket | null;
  loadingSocket: boolean;
};

const SocketContext = createContext<SocketContextType | undefined>(undefined);
export default SocketContext;