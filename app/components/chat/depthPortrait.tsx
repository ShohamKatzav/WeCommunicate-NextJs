'use client';
import { useEffect, useRef } from 'react';
import {
    AmbientLight,
    CanvasTexture,
    DirectionalLight,
    MathUtils,
    Mesh,
    MeshStandardMaterial,
    PerspectiveCamera,
    PlaneGeometry,
    PointLight,
    Scene,
    SRGBColorSpace,
    Texture,
    WebGLRenderer,
} from 'three';
import { useT } from '../../i18n/client';

// The voice-call stand-in for a camera: the peer's photo as a lit relief,
// raised by the depth map their browser made when they uploaded it (see
// app/lib/avatarDepth.ts). Loaded on demand by CallOverlay, which keeps the
// flat Avatar on screen until onReady, and for good after onFail.

interface DepthPortraitProps {
    avatarUrl: string;
    depthUrl: string;
    // The remote stream, for the voice-driven light. Only analysed, never
    // played - CallOverlay's RemoteAudio already plays it.
    stream: MediaStream | null;
    name: string;
    size: number;
    className?: string;
    onReady: () => void;
    onFail: () => void;
}

const SEGMENTS = 64;
// How far the nearest point stands out, in plane widths.
const RELIEF_DEPTH = 0.2;
const MAX_ORBIT = MathUtils.degToRad(12);
const DRAG_ORBIT_PER_PX = MathUtils.degToRad(0.25);
const TILT_ORBIT_PER_DEGREE = 0.012;

function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        // WebGL can't use a cross-origin image without CORS; Vercel Blob
        // sends Access-Control-Allow-Origin: *.
        image.crossOrigin = 'anonymous';
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Couldn't load ${url}`));
        image.src = url;
    });
}

// The same centered square crop the flat Avatar shows (object-cover), as
// texture coordinates of an image with this aspect ratio.
function coverCrop(width: number, height: number) {
    const aspect = width / height;
    return aspect >= 1
        ? { repeatX: 1 / aspect, repeatY: 1, offsetX: (1 - 1 / aspect) / 2, offsetY: 0 }
        : { repeatX: 1, repeatY: aspect, offsetX: 0, offsetY: (1 - aspect) / 2 };
}

// Depth in 0..1 (the model's near = bright) at texture coordinates u, v.
function depthSampler(image: HTMLImageElement) {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(image, 0, 0);
    const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
    const at = (x: number, y: number) => data[(Math.min(height - 1, y) * width + Math.min(width - 1, x)) * 4] / 255;
    const crop = coverCrop(width, height);
    return (u: number, v: number) => {
        // Textures run bottom-up, image rows top-down.
        const x = (crop.offsetX + u * crop.repeatX) * (width - 1);
        const y = (1 - (crop.offsetY + v * crop.repeatY)) * (height - 1);
        const x0 = Math.floor(x), y0 = Math.floor(y);
        const fx = x - x0, fy = y - y0;
        const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx;
        const bottom = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx;
        return top * (1 - fy) + bottom * fy;
    };
}

// A round medallion like the flat Avatar, with a soft edge.
function circleAlphaMap() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const context = canvas.getContext('2d')!;
    const gradient = context.createRadialGradient(128, 128, 122, 128, 128, 128);
    gradient.addColorStop(0, '#fff');
    gradient.addColorStop(1, '#000');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);
    return new CanvasTexture(canvas);
}

const DepthPortrait = ({ avatarUrl, depthUrl, stream, name, size, className = '', onReady, onFail }: DepthPortraitProps) => {
    const t = useT();
    const containerRef = useRef<HTMLDivElement>(null);
    // Written by the audio effect, read every frame by the scene's loop.
    const analyserRef = useRef<AnalyserNode | null>(null);
    const callbacksRef = useRef({ onReady, onFail });
    useEffect(() => { callbacksRef.current = { onReady, onFail }; });

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        // A canvas per run: forceContextLoss() below leaves a canvas with a
        // dead context, so one React reuses (a Strict Mode remount, a new
        // picture) could never draw again.
        const canvas = document.createElement('canvas');
        canvas.setAttribute('aria-hidden', 'true');
        canvas.className = 'h-full w-full cursor-grab touch-none active:cursor-grabbing';
        container.appendChild(canvas);
        let disposed = false;
        let failed = false;
        const fail = () => {
            if (failed || disposed) return;
            failed = true;
            callbacksRef.current.onFail();
        };

        let renderer: WebGLRenderer;
        try {
            renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
        } catch {
            canvas.remove();
            fail();
            return;
        }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(size, size, false);
        canvas.addEventListener('webglcontextlost', fail);

        const scene = new Scene();
        const camera = new PerspectiveCamera(28, 1, 0.1, 10);
        camera.position.set(0, 0, 2.3);
        scene.add(new AmbientLight(0xffffff, 0.55));
        const keyLight = new DirectionalLight(0xffffff, 1.4);
        keyLight.position.set(-0.8, 1, 1.6);
        scene.add(keyLight);
        // The one that follows the voice - the app's purple.
        const voiceLight = new PointLight(0xc084fc, 0, 4, 1.5);
        voiceLight.position.set(0.3, -0.2, 1.1);
        scene.add(voiceLight);

        const geometry = new PlaneGeometry(1, 1, SEGMENTS, SEGMENTS);
        const alphaMap = circleAlphaMap();
        const material = new MeshStandardMaterial({ alphaMap, transparent: true, roughness: 0.75, metalness: 0.05 });
        const mesh = new Mesh(geometry, material);
        scene.add(mesh);
        const textures: Texture[] = [alphaMap];

        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const orbit = { yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0 };
        const tilt = { yaw: 0, pitch: 0, baseline: null as { beta: number; gamma: number } | null };
        let dragging: { x: number; y: number; yaw: number; pitch: number } | null = null;
        let level = 0;
        let frame = 0;
        let loaded = false;
        let running = false;
        let onScreen = true;
        const waveform = new Uint8Array(512);
        const startedAt = performance.now();

        const draw = () => {
            frame = requestAnimationFrame(draw);
            const analyser = analyserRef.current;
            let loudness = 0;
            if (analyser) {
                analyser.getByteTimeDomainData(waveform);
                let sum = 0;
                for (const sample of waveform) sum += ((sample - 128) / 128) ** 2;
                loudness = Math.min(1, Math.sqrt(sum / waveform.length) * 4);
            }
            // Rises with a syllable, fades over a few frames after it.
            level += (loudness - level) * (loudness > level ? 0.5 : 0.08);
            voiceLight.intensity = level * 3;
            voiceLight.position.x = 0.3 + level * 0.25;

            const seconds = (performance.now() - startedAt) / 1000;
            const idleYaw = reduceMotion ? 0 : Math.sin(seconds * 0.6) * MathUtils.degToRad(2);
            const targetYaw = dragging ? orbit.targetYaw : tilt.yaw + idleYaw;
            const targetPitch = dragging ? orbit.targetPitch : tilt.pitch;
            orbit.yaw += (targetYaw - orbit.yaw) * 0.12;
            orbit.pitch += (targetPitch - orbit.pitch) * 0.12;
            mesh.rotation.set(orbit.pitch, orbit.yaw, 0);
            renderer.render(scene, camera);
        };
        // Only while it can be seen: a hidden tab or a scrolled-away overlay
        // doesn't need 60 frames a second.
        const updateLoop = () => {
            const shouldRun = !disposed && !failed && onScreen && document.visibilityState === 'visible' && loaded;
            if (shouldRun && !running) {
                running = true;
                frame = requestAnimationFrame(draw);
            } else if (!shouldRun && running) {
                running = false;
                cancelAnimationFrame(frame);
            }
        };
        const observer = new IntersectionObserver(([entry]) => {
            onScreen = entry.isIntersecting;
            updateLoop();
        });
        observer.observe(canvas);
        document.addEventListener('visibilitychange', updateLoop);

        const clampOrbit = (angle: number) => MathUtils.clamp(angle, -MAX_ORBIT, MAX_ORBIT);
        const onPointerDown = (event: PointerEvent) => {
            dragging = { x: event.clientX, y: event.clientY, yaw: orbit.yaw, pitch: orbit.pitch };
            orbit.targetYaw = orbit.yaw;
            orbit.targetPitch = orbit.pitch;
            canvas.setPointerCapture(event.pointerId);
        };
        const onPointerMove = (event: PointerEvent) => {
            if (!dragging) return;
            orbit.targetYaw = clampOrbit(dragging.yaw + (event.clientX - dragging.x) * DRAG_ORBIT_PER_PX);
            orbit.targetPitch = clampOrbit(dragging.pitch + (event.clientY - dragging.y) * DRAG_ORBIT_PER_PX);
        };
        // Let go and it eases back.
        const onPointerUp = () => { dragging = null; };
        canvas.addEventListener('pointerdown', onPointerDown);
        canvas.addEventListener('pointermove', onPointerMove);
        canvas.addEventListener('pointerup', onPointerUp);
        canvas.addEventListener('pointercancel', onPointerUp);

        // Tilt only where it needs no permission: iOS asks through
        // requestPermission(), which would mean a prompt mid-call.
        const Orientation = typeof DeviceOrientationEvent === 'undefined' ? null
            : DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
        const useTilt = !!Orientation && typeof Orientation.requestPermission !== 'function' && !reduceMotion;
        const onOrientation = (event: DeviceOrientationEvent) => {
            if (event.beta === null || event.gamma === null) return;
            // Relative to however the phone was held when the call started.
            tilt.baseline ??= { beta: event.beta, gamma: event.gamma };
            tilt.yaw = clampOrbit((event.gamma - tilt.baseline.gamma) * TILT_ORBIT_PER_DEGREE);
            tilt.pitch = clampOrbit((event.beta - tilt.baseline.beta) * TILT_ORBIT_PER_DEGREE);
        };
        if (useTilt) window.addEventListener('deviceorientation', onOrientation);

        (async () => {
            try {
                const [photo, depth] = await Promise.all([loadImage(avatarUrl), loadImage(depthUrl)]);
                if (disposed) return;
                const sample = depthSampler(depth);
                const positions = geometry.attributes.position;
                const uvs = geometry.attributes.uv;
                for (let i = 0; i < positions.count; i++) {
                    const u = uvs.getX(i), v = uvs.getY(i);
                    // Flattened toward the rim, so the medallion's edge
                    // doesn't end in a cliff.
                    const edge = 1 - MathUtils.smoothstep(Math.hypot(u - 0.5, v - 0.5), 0.36, 0.5);
                    positions.setZ(i, sample(u, v) * RELIEF_DEPTH * edge);
                }
                positions.needsUpdate = true;
                geometry.computeVertexNormals();

                const map = new Texture(photo);
                const crop = coverCrop(photo.naturalWidth, photo.naturalHeight);
                map.repeat.set(crop.repeatX, crop.repeatY);
                map.offset.set(crop.offsetX, crop.offsetY);
                map.colorSpace = SRGBColorSpace;
                map.needsUpdate = true;
                textures.push(map);
                material.map = map;
                material.needsUpdate = true;

                loaded = true;
                renderer.render(scene, camera);
                if (!failed) callbacksRef.current.onReady();
                updateLoop();
            } catch {
                fail();
            }
        })();

        return () => {
            disposed = true;
            cancelAnimationFrame(frame);
            observer.disconnect();
            document.removeEventListener('visibilitychange', updateLoop);
            window.removeEventListener('deviceorientation', onOrientation);
            canvas.removeEventListener('pointerdown', onPointerDown);
            canvas.removeEventListener('pointermove', onPointerMove);
            canvas.removeEventListener('pointerup', onPointerUp);
            canvas.removeEventListener('pointercancel', onPointerUp);
            canvas.removeEventListener('webglcontextlost', fail);
            geometry.dispose();
            material.dispose();
            textures.forEach(texture => texture.dispose());
            renderer.dispose();
            // Browsers only keep a handful of WebGL contexts alive - the
            // portrait comes and goes with the remote camera.
            renderer.forceContextLoss();
            canvas.remove();
        };
    }, [avatarUrl, depthUrl, size]);

    // Tapped, not played: connecting this source to the context's
    // destination would play the voice a second time over RemoteAudio.
    useEffect(() => {
        if (!stream) return;
        let context: AudioContext | null = null;
        let source: MediaStreamAudioSourceNode | null = null;
        const connect = () => {
            if (source || stream.getAudioTracks().length === 0) return;
            try {
                context = new AudioContext();
                const analyser = context.createAnalyser();
                analyser.fftSize = 512;
                source = context.createMediaStreamSource(stream);
                source.connect(analyser);
                // Already allowed: the call itself started from a tap.
                context.resume().catch(() => { });
                analyserRef.current = analyser;
            } catch {
                // No voice light, just the still portrait.
            }
        };
        connect();
        // The remote audio track can land after the stream does.
        stream.addEventListener('addtrack', connect);
        return () => {
            stream.removeEventListener('addtrack', connect);
            analyserRef.current = null;
            source?.disconnect();
            context?.close().catch(() => { });
        };
    }, [stream]);

    return (
        <div className={className} style={{ width: size, height: size }}>
            <div ref={containerRef} className="h-full w-full" />
            <span className="sr-only">{t('calls.portraitOf', { name })}</span>
        </div>
    );
};

export default DepthPortrait;
