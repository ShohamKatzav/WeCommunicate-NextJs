import connectDB from "../../database/MongoDb";
import InitHistoryRepository from "../../database/InitHistoryDal"
import { NextRequest, NextResponse } from 'next/server'
import guard from "../../guards/guard"

export async function PUT(
  req: NextRequest
) {
  const verified = await guard(req);
  if (verified) {
    const body = await req.json();
    const { email } = body;
    try {
      await connectDB();
      const updatedDocument = await InitHistoryRepository.updateInitHistory(email);
      return NextResponse.json({ message: "success", updatedDocument }, { status: 200 });
    }
    catch (err) {
      console.error('Failed to retrieve messages:', err);
      return NextResponse.json({ error: "Failed to initialize accounts chat history" }, { status: 500 });
    }
  }
  return NextResponse.json({ error: "error: 'Authentication error" }, { status: 401 });
}
