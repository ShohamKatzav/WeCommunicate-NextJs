import { NextResponse } from 'next/server'
import { deleteConversation } from '@/app/lib/conversationActions'

export async function DELETE(request: any) {
      const body = await request.json();
      const conversationIdString = body.conversationId;
      try {
            const result = await deleteConversation(conversationIdString);
            if (!result?.success) {
                  return NextResponse.json(result, { status: 500 });
            }
            return NextResponse.json(result);
      }
      catch (error) {
            console.error("Failed deleting conversation:", error);
            return NextResponse.json({ success: false, error: 'Failed to delete conversation' }, { status: 500 });
      }
}
