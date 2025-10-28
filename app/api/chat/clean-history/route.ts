import connectDB from "../../database/MongoDb";
import AccountRepository from "../../database/AccountDal";
import CleanHistoryRepository from "../../database/CleanHistoryDal"
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(
  req: NextRequest
) {
  try {
    await connectDB();
    const body = await req.json();
    if (body.currentConversationId) {
      const userID = await AccountRepository.extractIDFromToken(req?.headers?.get('authorization')!);
      const updatedDocument = await CleanHistoryRepository.updateCleanHistory(userID, body.currentConversationId);
      return NextResponse.json({ message: "success", updatedDocument }, { status: 200 });
    }
  }
  catch (err) {
    console.error('Failed to retrieve messages:', err);
    return NextResponse.json({ error: "Failed to clean accounts chat history" }, { status: 500 });
  }
}
