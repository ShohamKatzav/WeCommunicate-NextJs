import { env } from '@/app/config/env'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

const protectedRoutes = ['/chat', '/locations', '/moderator', '/share-target', '/profile']
const publicRoutes = ['/about', '/contact']
const publiclLoginRoutes = ['/', '/login', '/sign-up']

// Proxy and route handlers both run inside Render's Node process, where
// req.url resolves to the internal bind address (https://localhost:10000/...)
// rather than the public origin - a redirect built from it sends the browser
// (or, for a POST like /share-target, the OS share sheet) to a host that
// isn't reachable outside Render. NEXT_PUBLIC_BASE_ADDRESS is the canonical
// public origin (see the matching redirectInApp in app/share-target/route.ts).
// 303 rather than the default 307 so a POST (share-target) becomes a GET on
// the redirect instead of replaying its multipart body at /login, which has
// no POST handler and would 500.
function redirectToPublicOrigin(path: string) {
    return NextResponse.redirect(new URL(path, env.NEXT_PUBLIC_BASE_ADDRESS), 303)
}

export default async function middleware(req: NextRequest) {
    const path = req.nextUrl.pathname
    // Prefix-aware so nested routes (/profile/edit, /profile/[id]) are
    // covered by listing just '/profile' - safe for the pre-existing entries
    // too, since none of them have sub-routes today, so this changes nothing
    // for /chat, /locations, /moderator, /share-target.
    const isProtectedRoute = protectedRoutes.some(route => path === route || path.startsWith(route + '/'))
    const isPublicRoute = publicRoutes.includes(path)
    const isPublicLoginRoute = publiclLoginRoutes.includes(path)

    if (isPublicRoute) return NextResponse.next()

    const cookie = (await cookies()).get('user')?.value
    if (isProtectedRoute && !cookie)
        return redirectToPublicOrigin('/login')

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
        return redirectToPublicOrigin('/login')

    if (isPublicLoginRoute && verified) {
        return redirectToPublicOrigin('/chat')
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
        '/share-target',
        '/profile',
        '/profile/:path*',
    ],
}