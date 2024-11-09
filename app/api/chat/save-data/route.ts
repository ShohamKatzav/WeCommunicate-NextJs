import connectDB from "../../database/MongoDb";
import MessageRepository from "../../database/MessageDal"
import { NextRequest, NextResponse } from 'next/server'
import guard from "../../guards/guard"
import AccountRepository from "../../database/AccountDal";

export async function POST(
  req: NextRequest
) {
  await guard(req);
  const body = await req.json();
  try {
    await connectDB();
    const userID = await AccountRepository.extractIDFromToken(req?.headers?.get('authorization')!);
    const messageDoc = await MessageRepository.SaveMessage(body, userID);
    return NextResponse.json({ message: "success", messageDoc }, { status: 200 });
  } catch (err) {
    console.error('Failed to retrieve messages:', err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
