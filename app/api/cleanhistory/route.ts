import { NextResponse } from 'next/server'
import { cleanHistoryReplay } from '@/app/lib/conversationActions'

export async function POST(request: any) {
      try {
            const body = await request.json();
            const conversationIdString: string = body.conversationId;

            // This route is only ever reached by the offline queue's replay
            // (public/service-worker.js's processQueue POSTs the queued item
            // here) - the live/online clear goes straight through the
            // cleanHistory server action instead and never hits this route.
            // clearedAt is the click-time cutoff captured before the request
            // was queued; clamped to server "now" so a client with a clock
            // set in the future can't hide messages that haven't been sent
            // yet, and falls back to server time if it's missing or invalid
            // (e.g. an item queued by a build before this field existed).
            const serverNow = Date.now();
            const parsedClearedAt = typeof body.clearedAt === 'string' ? new Date(body.clearedAt).getTime() : NaN;
            const cutoff = Number.isFinite(parsedClearedAt) ? Math.min(parsedClearedAt, serverNow) : serverNow;

            const result = await cleanHistoryReplay(conversationIdString, cutoff);

            if (!result?.success) {
                  return NextResponse.json(result, { status: 500 });
            }
            return NextResponse.json(result);
      }
      catch (error) {
            console.error("Failed to clean history:", error);
            return NextResponse.json(
                  { success: false, error: 'Failed to clear history' },
                  { status: 500 }
            );
      }
}