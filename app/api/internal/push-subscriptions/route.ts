import { env } from '@/app/config/env';
import connectDB from '@/app/lib/MongoDb';
import PushSubscription from '@/models/PushSubscription';
import { NextResponse } from 'next/server';

// Lets e2e tests see which accounts a device's endpoint is registered to,
// and remove the fake one they registered. Playwright's Chromium refuses a
// real push subscription, so there is never a delivered push to observe.
async function readEndpoint(request: Request): Promise<string | NextResponse> {
    const { endpoint, bypassSecret } = await request.json();
    if (!env.TEST_BYPASS_KEY || bypassSecret !== env.TEST_BYPASS_KEY) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (typeof endpoint !== 'string') {
        return NextResponse.json({ error: 'Missing required field: endpoint' }, { status: 400 });
    }
    return endpoint;
}

function serverError(error: any): NextResponse {
    console.error('Push subscription test route error:', error);
    return NextResponse.json(
        { error: 'Internal server error', details: error.message },
        { status: 500 }
    );
}

export async function POST(request: Request): Promise<NextResponse> {
    try {
        const endpoint = await readEndpoint(request);
        if (endpoint instanceof NextResponse) return endpoint;

        await connectDB();
        const rows = await PushSubscription.find({ 'data.endpoint': endpoint })
            .select('email expiresAt')
            .lean() as unknown as { email: string; expiresAt: Date }[];
        return NextResponse.json({
            subscriptions: rows.map(({ email, expiresAt }) => ({ email, expiresAt }))
        });
    } catch (error: any) {
        return serverError(error);
    }
}

export async function DELETE(request: Request): Promise<NextResponse> {
    try {
        const endpoint = await readEndpoint(request);
        if (endpoint instanceof NextResponse) return endpoint;

        await connectDB();
        const { deletedCount } = await PushSubscription.deleteMany({ 'data.endpoint': endpoint });
        return NextResponse.json({ success: true, deletedCount });
    } catch (error: any) {
        return serverError(error);
    }
}
