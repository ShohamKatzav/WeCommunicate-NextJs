import RedisService from '@/services/RedisService';
import { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<NextResponse> {
    try {
        const body = await request.json();
        const { email, bypassSecret } = body;

        if (!email || !bypassSecret) {
            return NextResponse.json(
                { error: 'Missing required fields: email and bypassSecret' },
                { status: 400 }
            );
        }
        if (bypassSecret !== process.env.TEST_BYPASS_KEY) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const sockets = await RedisService.getUserSocketsByEmail(email);
        await Promise.all(
            sockets.map(id => RedisService.removeUserSocket(email, id))
        );

        await RedisService.clearAllNotifications(email);

        return NextResponse.json({
            success: true,
            email,
            socketsCleared: sockets.length,
            notificationsCleared: 'all'
        });

    } catch (error: any) {
        console.error('Cleanup error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}