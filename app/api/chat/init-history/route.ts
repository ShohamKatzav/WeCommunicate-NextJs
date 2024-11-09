import connectDB from "../../database/MongoDb";
import AccountRepository from "../../database/AccountDal";
import InitHistoryRepository from "../../database/InitHistoryDal"
import { NextRequest, NextResponse } from 'next/server'
import guard from "../../guards/guard"

export async function PUT(
  req: NextRequest
) {
  await guard(req);
  try {
    await connectDB();
    const body = await req.json();
    if (body.currentConversationId) {
      const userID = await AccountRepository.extractIDFromToken(req?.headers?.get('authorization')!);
      const updatedDocument = await InitHistoryRepository.updateInitHistory(userID, body.currentConversationId);
      return NextResponse.json({ message: "success", updatedDocument }, { status: 200 });
    }
  }
  catch (err) {
    console.error('Failed to retrieve messages:', err);
    return NextResponse.json({ error: "Failed to initialize accounts chat history" }, { status: 500 });
  }
}
