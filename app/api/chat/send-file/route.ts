import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

import connectDB from "../../database/MongoDb";
import AccountRepository from "../../database/AccountDal";

export async function POST(request: Request): Promise<NextResponse> {
    const body = (await request.json()) as HandleUploadBody;
    const authHeader = request.headers.get("authorization");
    const senderEmail = request.headers.get("email");

    // Extract user ID early, before the upload starts
    let userID: string | null = null;
    try {
        if (authHeader) {
            await connectDB();
            userID = await AccountRepository.extractIDFromToken(authHeader);
        }
    } catch (err) {
        console.error('Failed to authenticate:', err);
        return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
        );
    }

    try {
        const jsonResponse = await handleUpload({
            body,
            request,
            onBeforeGenerateToken: async (pathname) => {
                // Pass the user ID through tokenPayload
                return {
                    allowedContentTypes: [
                        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
                        'audio/mp3', 'audio/mpeg',
                        'video/x-msvideo', 'video/mp4', 'video/mpeg', 'video/ogg', 'video/webm',
                        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        'application/pdf'
                    ],
                    addRandomSuffix: true,
                    tokenPayload: JSON.stringify({
                        userID: userID,
                        senderEmail: senderEmail, // Pass email through payload
                        uploadedAt: new Date().toISOString(),
                    }),
                };
            },
            onUploadCompleted: async ({ blob, tokenPayload }) => {
                // This is called by Vercel's webhook, NOT from the client
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