import { NextResponse } from 'next/server'
import { saveMessage, deleteMessage } from '@/app/lib/chatActions'


export async function POST(request: any) {
      const body = await request.json();
      const message = body.messageBody;
      try {
            const result = await saveMessage(message);
            if (!result?.success) {
                  // Moderation-blocked, banned, or rate-limited - a definite
                  // rejection, not a transient failure. Returning 200 here
                  // (as before) made the offline queue treat this as
                  // successfully synced and silently drop it.
                  return NextResponse.json(result, { status: 422 });
            }
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
            const result = await deleteMessage(messageIdString);
            if (!result?.success) {
                  return NextResponse.json(result, { status: 403 });
            }
            return NextResponse.json(result);
      }
      catch (error) {
            console.error("Failed deleting message:", error);
            return NextResponse.json({ success: false, message: 'Failed to delete message' }, { status: 500 });
      }
}
