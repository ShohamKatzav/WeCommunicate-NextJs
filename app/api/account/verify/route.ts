import { NextRequest, NextResponse } from 'next/server';
import guard from "../../guards/guard"

export async function POST(
  req: NextRequest,
  res: NextResponse,
) {

  const verified = await guard(req);

  if (verified) {
      return NextResponse.json({ status: 'logged in', message: 'success' }, { status: 200 });
  } else {
      return NextResponse.json({ error: 'Authentication error: Token missing or invalid' }, { status: 401 });
  }
}