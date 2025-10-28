import { NextResponse, NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'

const jwtSecretKey = process.env.TOKEN_SECRET!;

export default function proxy(req: any) {
  let token = "";

  // Handle Socket.IO requests (object with token property)
  if ('token' in req && req.token) {
    token = req.token.toString();
  }
  // Handle Next.js page/API requests
  else if (req instanceof NextRequest) {
    // Try Authorization header first
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }
    // Try cookie as fallback (Pages Requests)
    else {
      const cookieUser = req.cookies.get('user')?.value;
      if (cookieUser) {
        try {
          const userData = JSON.parse(decodeURIComponent(cookieUser));
          token = userData.token;
        } catch (err) {
          console.error('Failed to parse user cookie:', err);
        }
      }
      else {
        return NextResponse.redirect(new URL('/login', req.url));
      }
    }
  }
  // No token — redirect to login (only for NextRequest)
  if (!token) {
    if (req instanceof NextRequest) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    return null;
  }

  try {
    const verified = jwt.verify(token, jwtSecretKey);
    if (verified && req instanceof NextRequest) {
      return NextResponse.next();
    }
  } catch (err) {
    return false;
    // Invalid token → redirect to login
  }

  return true; // For socket.io
}

export const config = {
  matcher: [
    '/api/account/verify',
    '/api/account/get-usernames',
    '/api/chat/:path*',
    '/api/conversation/:path*',
    '/api/location/:path*',
    '/chat/:path*',
  ],
};