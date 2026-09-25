import { del } from '@vercel/blob';

// Server-side deletion of Vercel Blob files that are already attached to
// something (a sent message's file, an avatar). Deliberately not a server
// action: app/lib/fileActions.ts's deleteFile is the browser-callable path,
// and it refuses attached files so no one can delete another sender's
// attachment. Callers here have already checked who owns the file.
export default class BlobService {
    static async deleteBlobs(urls: (string | undefined | null)[]) {
        const unique = [...new Set(urls.filter((url): url is string => typeof url === 'string' && url.length > 0))];
        if (unique.length === 0) return;
        // del() takes a batch; a URL that's already gone is not an error.
        await del(unique);
    }
}
