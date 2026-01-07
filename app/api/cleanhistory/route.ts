import { NextResponse } from 'next/server'
import { cleanHistory } from '@/app/lib/conversationActions'

export async function POST(request: any) {
      try {
            const body = await request.json();
            const conversationIdString: string = body.conversationId;

            const result = await cleanHistory(conversationIdString);

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