import { env } from '@/app/config/env'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

const protectedRoutes = ['/chat', '/locations', '/moderator']
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
            verified = jwt.verify(user.token, env.JWT_SECRET_KEY!)
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
        '/chat',
        '/locations',
        '/moderator',
        '/api/send-file',
    ],
}