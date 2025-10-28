import { NextRequest, NextResponse } from 'next/server';
import connectDB from "../../database/MongoDb";
import ConversationRepository from "../../database/ConversationDal";
import { Types } from 'mongoose';
import AccountRepository from '../../database/AccountDal';

export async function GET(
  req: NextRequest
) {
  try {
    await connectDB();
    const userID = await AccountRepository.extractIDFromToken(req?.headers?.get('authorization')!);
    const recentConversations = await ConversationRepository.GetRecentConversations(
      Types.ObjectId.createFromHexString(userID)
    );
    return NextResponse.json({ message: "success", recentConversations }, { status: 200 });

  } catch (err: any) {
    if (err.message === "Internal Server Error") {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  }
}