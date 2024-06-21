import { NextResponse } from 'next/server'

export async function GET() {
      console.log({ message: 'Successfully woke up' });
      return NextResponse.json({ message: 'Successfully woke up' });
}
