import type { NextApiRequest, NextApiResponse } from 'next';
import type { Server as HttpServer } from 'http';
import type { Socket as NetSocket } from 'net';
import type { Server as IOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '@/app/config/env';
import { declineCallFromNotification } from '@/socket/handlers';

type ResponseWithIO = NextApiResponse & {
    socket: NetSocket & { server: HttpServer & { io?: IOServer } };
};

// The Decline button on a ring notification (public/service-worker.js). The
// service worker has no socket, so it declines over HTTP with the session
// cookie. A pages route rather than an app route because it needs the
// Socket.IO server, which lives on this HTTP server (see ./socket).
export default async function handler(req: NextApiRequest, res: ResponseWithIO) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).end();
    }

    let email: string | undefined;
    try {
        const { token } = JSON.parse(req.cookies.user ?? '');
        email = (jwt.verify(token, env.JWT_SECRET_KEY!) as { email?: string }).email;
    } catch {
        email = undefined;
    }
    if (!email) return res.status(401).end();

    const io = res.socket.server.io;
    // No socket server yet means no call could be ringing.
    if (!io || typeof req.body !== 'object' || req.body === null) return res.status(404).end();

    const { callId, conversationId, pushEndpoint } = req.body;
    // The ring may be over already (answered on another device, cancelled,
    // timed out) - nothing to decline then, which is fine.
    try {
        const declined = await declineCallFromNotification(io, email, { callId, conversationId, pushEndpoint });
        return res.status(declined ? 204 : 404).end();
    } catch (error) {
        console.error('Declining a call from its notification failed:', error instanceof Error ? error.message : error);
        return res.status(500).end();
    }
}
