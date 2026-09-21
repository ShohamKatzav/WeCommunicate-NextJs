import { isSamsungInternet } from '@/app/utils/samsungInternet';

const ICONS = [
    { purpose: 'any', sizes: '192x192', src: '/icon192.png', type: 'image/png' },
    { purpose: 'maskable', sizes: '192x192', src: '/icon192_maskable.png', type: 'image/png' },
    { purpose: 'maskable', sizes: '512x512', src: '/icon512_maskable.png', type: 'image/png' },
    { purpose: 'any', sizes: '512x512', src: '/icon512_rounded.png', type: 'image/png' },
    { purpose: 'any', sizes: '512x512', src: '/icon.png', type: 'image/png' },
] as const;

const CHROME_SHARE_TARGET = {
    action: '/share-target',
    method: 'POST',
    enctype: 'multipart/form-data',
    params: {
        title: 'title',
        text: 'text',
        url: 'url',
        files: [
            {
                name: 'file',
                // MIME types only. File extensions (".pdf", ".doc") are legal
                // in the Web Share Target spec but Android's WebAPK/TWA
                // generator writes them into an <intent-filter> as-is, which
                // fails package parsing. Chrome install survived this;
                // Samsung's packager does not.
                accept: [
                    'image/*',
                    'video/*',
                    'audio/*',
                    'application/pdf',
                    'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                ],
            },
        ],
    },
} as const;

// Samsung Internet's WebAPK builder treats `method: POST` (and file share
// params) as a failed download in the Android notification shade - Chrome
// on the same phone installs the same origin fine. GET + title/text/url is
// what that packager accepts; file shares still work from a Chrome-installed
// WebAPK. Defaulting unknown UAs (the packager is often okhttp, not
// "SamsungBrowser") to GET is what makes the download succeed; Chromium
// browsers that actually support POST file shares opt in below.
const GET_SHARE_TARGET = {
    action: '/share-target',
    method: 'GET',
    enctype: 'application/x-www-form-urlencoded',
    params: {
        title: 'title',
        text: 'text',
        url: 'url',
    },
} as const;

export function wantsPostShareTarget(userAgent: string | null): boolean {
    if (isSamsungInternet(userAgent)) return false;
    // Chrome/Edge/Opera. Samsung Internet also contains "Chrome/xx" so the
    // Samsung check above has to win. Playwright's HeadlessChrome matches.
    return /\b(Chrome|Edg|OPR)\//.test(userAgent ?? '');
}

export function buildWebManifest(userAgent: string | null) {
    const postShare = wantsPostShareTarget(userAgent);
    return {
        name: 'WeCommunicate',
        short_name: 'WeCommunicate',
        description: 'WeCommunicate is a chat app',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        lang: 'en-US',
        theme_color: '#8936FF',
        background_color: '#2EC6FE',
        // `dir` / `orientation` are omitted outside Chromium: Samsung's
        // packager is older than Chrome's and has been seen rejecting
        // values it doesn't recognise rather than ignoring them.
        ...(postShare ? { dir: 'auto', orientation: 'portrait-primary' } : {}),
        share_target: postShare ? CHROME_SHARE_TARGET : GET_SHARE_TARGET,
        icons: ICONS,
    };
}

export function webManifestContentType(userAgent: string | null): string {
    // X-Content-Type-Options: nosniff is on every response. If Samsung's
    // packager doesn't treat application/manifest+json as JSON, it refuses
    // the payload. Chrome understands both; everyone else gets application/json.
    return wantsPostShareTarget(userAgent)
        ? 'application/manifest+json; charset=utf-8'
        : 'application/json; charset=utf-8';
}
