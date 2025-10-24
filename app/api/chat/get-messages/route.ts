import connectDB from "../../database/MongoDb";
import { NextRequest, NextResponse } from 'next/server';
import AccountRepository from "../../database/AccountDal";
import InitHistoryRepository from "../../database/InitHistoryDal";
import MessageRepository from "../../database/MessageDal";
import ConversationRepository from "../../database/ConversationDal";
import mongoose from "mongoose";
import { IAccount } from "../../models/Account";

export async function GET(
  req: NextRequest
) {
  const url = new URL(req.url);
  const searchParams = new URLSearchParams(url.search);
  const participantsId = searchParams.getAll('participantsId[]');
  const page = parseInt(searchParams.get("page") as string);
  const perPage = parseInt(searchParams.get("perPage") as string);

  try {
    await connectDB();
    let chatQuery: any;
    let chat: any = [];
    let totalMessagesCount = 0;

    const userID = await AccountRepository.extractIDFromToken(req?.headers?.get('authorization')!);
    if (typeof userID !== "string") {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    const partners = await AccountRepository.getUsersByID(participantsId!);

    if (!userID || !partners) {
      return NextResponse.json({ message: "Users not found", chat: [] });
    }

    // Check for existing conversation between the users
    const conversation = await ConversationRepository.GetConversationByMembers([
      new mongoose.Types.ObjectId(userID),
      ...partners.map((partner: IAccount) => new mongoose.Types.ObjectId(partner._id.toString()))
    ]);

    // If no conversation exists, return an empty response
    if (!conversation) {
      return NextResponse.json({ message: "No conversation exists between the users", chat: [] });
    }

    chatQuery = { conversation: conversation._id };

    if (conversation) {
      const initHistoryTime = await InitHistoryRepository.findInitHistory(
        new mongoose.Types.ObjectId(userID),
        conversation._id
      );
      if (initHistoryTime) {
        chatQuery.date = { $gt: initHistoryTime.date }; // Filter messages after init history time
      }
      totalMessagesCount = await MessageRepository.countMessages(chatQuery);
    }

    const skipCount: number = perPage * page;

    if (totalMessagesCount < skipCount) {
      if (skipCount - perPage < totalMessagesCount)
        chat = await MessageRepository.GetMessages(chatQuery, totalMessagesCount % perPage, 0);
      return NextResponse.json({ message: "All data fetched", chat, conversation: conversation._id });
    }

    chat = await MessageRepository.GetMessages(chatQuery, perPage, totalMessagesCount - perPage * page);
    return NextResponse.json({ message: "success", chat, conversation: conversation._id });

  } catch (err) {
    console.error('Failed to retrieve messages:', err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}