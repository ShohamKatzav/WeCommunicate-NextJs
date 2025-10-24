import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  req: NextRequest
) {
  return NextResponse.json({ status: 'logged in', message: 'success' }, { status: 200 });
}