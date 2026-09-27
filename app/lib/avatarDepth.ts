import { upload } from '@vercel/blob/client';
import { setMyAvatarDepth } from './profileActions';
import type { AvatarDepthWorkerMessage } from './avatarDepthWorker';

export type AvatarDepthStatus = 'estimating' | 'downloading';

// A first run downloads the model (~27 MB) before the few seconds of work
// itself - past this, something is stuck and the picture stays flat.
const DEPTH_TIMEOUT_MS = 3 * 60 * 1000;

function estimateDepth(image: Blob, onStatus: (status: AvatarDepthStatus) => void): Promise<Blob> {
    return new Promise((resolve, reject) => {
        // A new worker per picture, ended right after: the model holds on to
        // well over 100 MB, and pictures change rarely.
        const worker = new Worker(new URL('./avatarDepthWorker.ts', import.meta.url), { type: 'module' });
        const timer = setTimeout(() => finish(new Error('Depth estimation timed out')), DEPTH_TIMEOUT_MS);
        const finish = (error: Error | null, depthMap?: Blob) => {
            clearTimeout(timer);
            worker.terminate();
            if (error) reject(error);
            else resolve(depthMap!);
        };
        worker.onmessage = (event: MessageEvent<AvatarDepthWorkerMessage>) => {
            const message = event.data;
            if (message.type === 'status') onStatus(message.status);
            else if (message.type === 'done') finish(null, message.depthMap);
            else finish(new Error(message.message));
        };
        worker.onerror = event => finish(new Error(event.message || 'Depth worker failed to start'));
        worker.postMessage(image);
    });
}

// After an avatar upload has been saved: makes the depth map the call
// portrait (depthPortrait.tsx) needs, stores it next to the picture, and
// resolves to its URL. Throws on any failure - callers only log it, since
// the avatar itself is already saved and this is an extra.
export async function makeAvatarDepth(
    image: Blob,
    forAvatarUrl: string,
    token: string,
    onStatus: (status: AvatarDepthStatus) => void
): Promise<string> {
    const depthMap = await estimateDepth(image, onStatus);
    const blob = await upload('avatar-depth.png', depthMap, {
        access: 'public',
        handleUploadUrl: '/api/send-file',
        contentType: 'image/png',
        headers: { authorization: `Bearer ${token}` },
    });
    const result = await setMyAvatarDepth(blob.url, forAvatarUrl);
    if (!result.success || !result.avatarDepthUrl) throw new Error(result.error || 'Depth map not saved');
    return result.avatarDepthUrl;
}
