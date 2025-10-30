import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

const jwtSecretKey = process.env.TOKEN_SECRET
if (!jwtSecretKey) throw new Error('TOKEN_SECRET environment variable is not set')

const protectedRoutes = ['/chat', '/locations']
const publicRoutes = ['/about', '/contact']
const publiclLoginRoutes = ['/', '/login', '/sign-up']

export default async function middleware(req: NextRequest) {
    const path = req.nextUrl.pathname
    const isProtectedRoute = protectedRoutes.includes(path)
    const isPublicRoute = publicRoutes.includes(path)
    const isPublicLoginRoute = publiclLoginRoutes.includes(path)

    if (isPublicRoute) return NextResponse.next()

    const cookie = (await cookies()).get('user')?.value
    if (isProtectedRoute && !cookie)
        return NextResponse.redirect(new URL('/login', req.url))

    let verified = null
    if (cookie) {
        try {
            const user = JSON.parse(cookie)
            verified = jwt.verify(user.token, jwtSecretKey!)
        } catch {
            verified = null
        }
    }

    if (isProtectedRoute && !verified)
        return NextResponse.redirect(new URL('/login', req.url))

    if (isPublicLoginRoute && verified) {
        return NextResponse.redirect(new URL('/chat', req.url))
    }
    return NextResponse.next()
}

export const config = {
    matcher: [
        '/',
        '/login',
        '/sign-up',
        '/chat/:path*',
        '/api/send-file',
    ],
}