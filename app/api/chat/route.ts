import { NextResponse } from 'next/server'
import { saveMessage, deleteMessage } from '@/app/lib/chatActions'


export async function POST(request: any) {
      const body = await request.json();
      const message = body.messageBody;
      try {
            const result = await saveMessage(message);
            const { messageDoc } = result;
            return NextResponse.json(messageDoc);
      }
      catch (error) {
            console.error("Failed saving message:", error);
            return new NextResponse(JSON.stringify({ error: 'Failed to save message' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
}
export async function DELETE(request: any) {
      const body = await request.json();
      const messageIdString = body.messageId;
      try {
            await deleteMessage(messageIdString);
      }
      catch {
            console.error("Faild deleting");
      }
      return NextResponse.json({ message: 'Successfully deleted message' });
}
