import { NextResponse } from 'next/server'
import { deleteConversation } from '@/app/lib/conversationActions'

export async function DELETE(request: any) {
      const body = await request.json();
      const conversationIdString = body.conversationId;
      try {
            await deleteConversation(conversationIdString);
      }
      catch {
            console.error("Faild deleting");
      }
      return NextResponse.json({ message: 'Successfully deleted conversation' });
}
