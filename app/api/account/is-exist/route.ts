import connectDB from "../../database/MongoDb";
import AccountRepository from "../../database/AccountDal"
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  req: NextRequest
) {

  const body = await req.json();
  const { email } = body;
  try {
    await connectDB();
    const userExists = await AccountRepository.getUserByEmail(email);
    const status = userExists != null ? 200 : 401;
    const accountExists = status == 200 ? true : false;
    return NextResponse.json({ accountExists }, { status });
  } catch (err) {
    console.error('Failed to find user:', err);
    throw err;
  }
}
