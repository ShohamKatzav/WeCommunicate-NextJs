import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { env } from '@/app/config/env';
import jwt from 'jsonwebtoken';

export async function POST(request: Request): Promise<NextResponse> {

    const body = (await request.json()) as HandleUploadBody;

    try {
        const jsonResponse = await handleUpload({
            body,
            request,
            onBeforeGenerateToken: async () => {
                // The client sends its session token as an Authorization header
                // (see uploadFile.tsx). Without this check anyone could call this
                // route directly and get a token to upload to our blob store for
                // free, regardless of whether they are logged in.
                const authHeader = request.headers.get('authorization');
                const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
                if (!token) {
                    throw new Error('Unauthorized');
                }
                try {
                    jwt.verify(token, env.JWT_SECRET_KEY);
                } catch {
                    throw new Error('Unauthorized');
                }

                return {
                    allowedContentTypes: [
                        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
                        // audio/mp3+audio/mpeg cover general audio file uploads; audio/webm
                        // and audio/mp4/audio/aac are what voiceRecorder.tsx's MediaRecorder
                        // actually produces (webm+opus almost everywhere, mp4 on Safari/iOS -
                        // rejecting either here would make recording succeed but sending fail).
                        'audio/mp3', 'audio/mpeg', 'audio/webm', 'audio/mp4', 'audio/aac',
                        'video/x-msvideo', 'video/mp4', 'video/mpeg', 'video/ogg', 'video/webm',
                        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        'application/pdf'
                    ],
                    addRandomSuffix: true,
                    // Match the 10MB limit enforced client-side (uploadFile.tsx) so it
                    // can't be bypassed by calling this endpoint directly.
                    maximumSizeInBytes: 10 * 1024 * 1024,
                };
            },
        });

        return NextResponse.json(jsonResponse);
    } catch (error) {
        return NextResponse.json(
            { error: (error as Error).message },
            { status: 400 },
        );
    }
}
