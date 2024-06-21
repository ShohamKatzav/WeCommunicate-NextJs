import connectDB from "../../database/MongoDb";
import MessageRepository from "../../database/MessageDal"
import { NextRequest, NextResponse } from 'next/server'
import guard from "../../guards/guard"

export async function POST(
  req: NextRequest
) {
  const verified = await guard(req);
  if (verified) {
    const body = await req.json();
    try {
      await connectDB();
      const messageDoc = MessageRepository.SaveMessage(body);
      return NextResponse.json({ message: "success", messageDoc}, { status: 200 });
    } catch (err) {
      console.error('Failed to retrieve messages:', err);
      return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
  }
  return NextResponse.json({ error: "error: 'Authentication error" }, { status: 401 });
}
