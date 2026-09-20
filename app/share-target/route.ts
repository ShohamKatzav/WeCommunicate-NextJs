import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { randomUUID } from 'crypto';
import { extractUserIDFromCoockie } from '@/app/lib/cookieActions';
import { MAX_MESSAGE_LENGTH } from '@/app/config/limits';
import RedisService from '@/services/RedisService';

// Matches the client-side upload cap (uploadFile.tsx) - a share arrives as a
// single server-side POST, so there's no per-chunk client validation to lean
// on here.
const MAX_SHARED_FILE_BYTES = 10 * 1024 * 1024;

// The OS share sheet POSTs here (see share_target in public/manifest.json)
// as a full-page navigation, not a fetch - a File object can't survive the
// redirect back to /chat, so it's uploaded here and handed off via a
// short-lived Redis entry (see RedisService.storeSharedContent) that /chat
// picks up and consumes once.
export async function POST(request: NextRequest) {
    // A regular browser navigation carries the session cookie automatically -
    // proxy.ts's middleware already gates this path, but that depends on its
    // matcher staying in sync with this route, so check again here too
    // rather than trusting that alone.
    let userID: string | null = null;
    try {
        userID = await extractUserIDFromCoockie();
    } catch {
        userID = null;
    }
    if (typeof userID !== 'string') {
        return NextResponse.redirect(new URL('/login', request.url), 303);
    }

    let formData: FormData;
    try {
        formData = await request.formData();
    } catch {
        return NextResponse.redirect(new URL('/chat', request.url), 303);
    }

    const title = formData.get('title')?.toString().trim() || '';
    const text = formData.get('text')?.toString().trim() || '';
    const url = formData.get('url')?.toString().trim() || '';
    const sharedFile = formData.get('file');

    let file;
    if (sharedFile instanceof File && sharedFile.size > 0 && sharedFile.size <= MAX_SHARED_FILE_BYTES) {
        try {
            const blob = await put(sharedFile.name, sharedFile, {
                access: 'public',
                addRandomSuffix: true,
            });
            file = {
                contentType: blob.contentType,
                url: blob.url,
                downloadUrl: blob.downloadUrl,
                pathname: blob.pathname,
            };
        } catch (err) {
            // Fall through without a file rather than failing the whole
            // share - the text/link portion (if any) is still worth
            // delivering.
            console.error('Failed to upload shared file:', err);
        }
    }

    const combinedText = [title, text, url]
        .filter(Boolean)
        .join('\n')
        .slice(0, MAX_MESSAGE_LENGTH);

    const token = randomUUID();
    await RedisService.storeSharedContent(token, { userID, text: combinedText, file });

    return NextResponse.redirect(new URL(`/chat?shared=${token}`, request.url), 303);
}
