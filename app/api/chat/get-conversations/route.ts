import { NextRequest, NextResponse } from 'next/server';
import connectDB from "../../database/MongoDb";
import AccountRepository from "../../database/AccountDal";
import ConversationRepository from "../../database/ConversationDal";
import guard from "../../guards/guard";
import { Types } from "mongoose";

export async function GET(
  req: NextRequest
) {
  await guard(req);

  try {
    await connectDB();
    const userID = await AccountRepository.extractIDFromToken(req?.headers?.get('authorization')!);
    const recentConversations = await ConversationRepository.GetRecentConversations(userID as unknown as Types.ObjectId);
    return NextResponse.json({ message: "success", recentConversations }, { status: 200 });

  } catch (err) {
    console.error('Failed to retrieve conversations:', err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}