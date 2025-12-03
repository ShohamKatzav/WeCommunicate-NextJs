import { NextResponse } from 'next/server'
import { cleanHistory } from '@/app/lib/conversationActions'


export async function POST(request: any) {
      const body = await request.json();
      const conversationIdString: string = body.conversationId;
      try {
            await cleanHistory(conversationIdString);
      }
      catch (error) {
            console.error("Failed to clean history:", error);
            return new NextResponse(JSON.stringify({ error: 'Failed to clear history' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
      return NextResponse.json({ message: 'History cleared successfully' });
}