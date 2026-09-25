import { NextRequest, NextResponse } from 'next/server';
import { buildWebManifest, webManifestContentType } from '@/app/lib/webManifest';
import { getT } from '@/app/i18n/server';

// Must not be statically generated: the body depends on User-Agent so
// Samsung Internet gets a GET share_target and Chrome keeps POST + files.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const userAgent = request.headers.get('user-agent');
    return NextResponse.json(buildWebManifest(userAgent, await getT()), {
        headers: {
            'Content-Type': webManifestContentType(userAgent),
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Vary': 'User-Agent, Accept-Language, Cookie',
        },
    });
}
