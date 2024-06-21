import connectDB from "../../database/MongoDb";
import { NextRequest, NextResponse } from 'next/server'
import AccountRepository from "../../database/AccountDal"
import InitHistoryRepository from "../../database/InitHistoryDal"
import MessageRepository from "../../database/MessageDal"
import guard from "../../guards/guard"

export async function GET(
  req: NextRequest
) {
  const verified = await guard(req);
  if (verified) {
    const url = new URL(req.url);
    const searchParams = new URLSearchParams(url.search);
    const email = searchParams.get("email");
    const page = parseInt(searchParams.get("page") as string);
    const perPage = parseInt(searchParams.get("perPage") as string);
    try {
      await connectDB();
      const user = await AccountRepository.getUserByEmail(email!);
      const initHistoryTime = await InitHistoryRepository.findInitHistory(user._id);

      const chatQuery = initHistoryTime ? { date: { $gt: initHistoryTime.date } } : {};
      const totalCount = await MessageRepository.countMessages(chatQuery);
      var chat = []
      const skipCount: number = perPage * page;
      if (totalCount < skipCount) {
        if (skipCount - perPage < totalCount)
          chat = await MessageRepository.GetMessages(chatQuery, totalCount % perPage, 0);
        return NextResponse.json({ message: "All data fetched", chat });
      }
      chat = await MessageRepository.GetMessages(chatQuery, perPage, totalCount - perPage * page);
      return NextResponse.json({ message: "success", chat });
    } catch (err) {
      console.error('Failed to retrieve messages:', err);
      return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
  }
  return NextResponse.json({ error: "error: 'Authentication error" }, { status: 401 });
}
