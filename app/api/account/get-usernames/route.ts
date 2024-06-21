import dbConnect from "../../database/MongoDb";
import AccountRepository from "../../database/AccountDal"
import { NextRequest, NextResponse } from 'next/server'
import guard from "../../guards/guard"

export async function GET(
  req: NextRequest
) {
  const verified = await guard(req);
  if (verified) {
    try {
      await dbConnect();
      const usersListResult = await AccountRepository.getUsernames();
      return NextResponse.json(usersListResult);
    } catch (err) {
      console.error('Failed to get usernames:', err);
      throw err;
    }
  } else {
    return NextResponse.json({ error: 'Authentication error: Token missing or invalid' }, { status: 401 });
  }
}
