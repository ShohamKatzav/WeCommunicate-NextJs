/// <reference lib="webworker" />
// Runs the depth model off the main thread: several seconds of WASM
// inference would otherwise freeze the profile page. Started and ended per
// picture by avatarDepth.ts.
import { env, pipeline, RawImage } from '@huggingface/transformers';

// Depth Anything V2 Small (Apache-2.0), 8-bit quantized: about 27 MB from
// the Hugging Face CDN the first time, then from the browser's Cache API.
const MODEL_ID = 'onnx-community/depth-anything-v2-small';
// Longest side of the stored map. The call portrait displaces a 64x64 grid,
// so anything finer is only bigger uploads.
const DEPTH_MAP_SIZE = 256;

env.allowLocalModels = false;
// ONNX Runtime's own files come from this origin rather than jsDelivr (the
// library's default), and its loader is imported from that URL as it is -
// not copied into a blob: URL first, which script-src doesn't allow.
env.useWasmCache = false;
const wasm = env.backends.onnx.wasm!;
wasm.wasmPaths = {
    mjs: new URL('../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs', import.meta.url).href,
    wasm: new URL('../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm', import.meta.url).href,
};
// Threads need a cross-origin isolated page, which this app isn't.
wasm.numThreads = 1;

export type AvatarDepthWorkerMessage =
    | { type: 'status'; status: 'downloading' | 'estimating' }
    | { type: 'done'; depthMap: Blob }
    | { type: 'error'; message: string };

const post = (message: AvatarDepthWorkerMessage) => self.postMessage(message);

self.onmessage = async (event: MessageEvent<Blob>) => {
    try {
        let downloading = false;
        const estimator = await pipeline('depth-estimation', MODEL_ID, {
            device: 'wasm',
            dtype: 'q8',
            // Only reports progress for files that aren't cached yet.
            progress_callback: progress => {
                if (!downloading && progress.status === 'progress') {
                    downloading = true;
                    post({ type: 'status', status: 'downloading' });
                }
            },
        });
        post({ type: 'status', status: 'estimating' });
        const image = await RawImage.fromBlob(event.data);
        const { depth } = await estimator(image);
        await estimator.dispose();
        const scale = Math.min(1, DEPTH_MAP_SIZE / Math.max(depth.width, depth.height));
        const depthMap = scale < 1
            ? await depth.resize(Math.round(depth.width * scale), Math.round(depth.height * scale))
            : depth;
        post({ type: 'done', depthMap: await depthMap.toBlob('image/png') });
    } catch (error) {
        post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
    }
};
