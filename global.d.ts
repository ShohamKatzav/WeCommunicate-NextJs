import mongoose from 'mongoose';
import { NextRequest as OriginalNextRequest } from 'next/server'
import { NextResponse as OriginalNextResponse } from 'next/server'
import { NextApiResponse } from 'next';
import { Server as NetServer, Socket } from 'net';
import { Server as SocketIOServer } from 'socket.io';
declare global {
    interface Location {
        latitude: Number;
        longitude: Number;
        accuracy: Number;
        error: String;
        accountID: mongoose.Types.ObjectId;
        time: Date;
    }
    interface RequestOrSocket extends OriginalNextRequest {
        user?: string;
        handshake?: {
            auth?: {
                token?: string;
            }
        }
    }
}
export { };