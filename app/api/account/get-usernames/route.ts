import dbConnect from "../../database/MongoDb";
import AccountRepository from "../../database/AccountDal"
import { NextRequest, NextResponse } from 'next/server'
import guard from "../../guards/guard"

export async function GET(
  req: NextRequest
) {
  await guard(req);
  try {
    await dbConnect();
    const usersListResult = await AccountRepository.getUsernames();
    return NextResponse.json(usersListResult);
  } catch (err) {
    console.error('Failed to get usernames:', err);
    throw err;
  }

}
