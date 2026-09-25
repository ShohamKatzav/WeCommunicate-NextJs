"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useT } from "../../i18n/client";
import { X } from "lucide-react";

interface ImageCropperProps {
    file: File;
    onCropped: (file: File) => void;
    onSkip: () => void;
    onCancel: () => void;
    busy?: boolean;
}

// The cropped avatar is written at this size regardless of the source, so a
// 12MP phone photo doesn't get stored (and re-downloaded by every chat row)
// at full resolution. Never upscales past what the crop actually contains.
const MAX_OUTPUT_SIZE = 512;
const MAX_ZOOM = 3;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

// Square crop, so both the visible frame and the exported canvas work from
// one number: the on-screen size of the crop window. Kept a little inside
// the viewport on small screens so the frame is never wider than the modal.
const viewportSize = () => (typeof window === "undefined" ? 256 : Math.min(256, window.innerWidth - 96));

export default function ImageCropper({ file, onCropped, onSkip, onCancel, busy }: ImageCropperProps) {
    const t = useT();
    const imageRef = useRef<HTMLImageElement | null>(null);
    const dragOrigin = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);

    const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
    const [viewport] = useState(viewportSize);
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });

    // Created and revoked in the same effect: a useMemo'd URL survives Strict
    // Mode's mount/unmount/remount while the effect's cleanup revokes it,
    // leaving the <img> pointing at a dead blob URL (just the alt text shows).
    const [objectUrl, setObjectUrl] = useState<string | null>(null);
    useEffect(() => {
        const url = URL.createObjectURL(file);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setObjectUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    // Scale that makes the image just cover the square frame - the floor for
    // zoom, so there's never a gap inside the crop.
    const coverScale = natural ? viewport / Math.min(natural.width, natural.height) : 1;
    const scale = coverScale * zoom;
    const displayWidth = natural ? natural.width * scale : 0;
    const displayHeight = natural ? natural.height * scale : 0;

    const clampOffset = (next: { x: number; y: number }) => ({
        x: clamp(next.x, viewport - displayWidth, 0),
        y: clamp(next.y, viewport - displayHeight, 0)
    });

    const handleImageLoad = () => {
        const image = imageRef.current;
        if (!image) return;
        const width = image.naturalWidth;
        const height = image.naturalHeight;
        setNatural({ width, height });

        // Start centred on the image's middle, which is what people expect a
        // "square crop of this photo" to mean before they touch anything.
        const initialScale = viewport / Math.min(width, height);
        setOffset({
            x: (viewport - width * initialScale) / 2,
            y: (viewport - height * initialScale) / 2
        });
    };

    const handleZoomChange = (nextZoom: number) => {
        if (!natural) return;
        const nextScale = coverScale * nextZoom;
        const nextWidth = natural.width * nextScale;
        const nextHeight = natural.height * nextScale;

        // Zoom around the centre of the frame rather than the image's corner,
        // otherwise the subject drifts out of the crop as you zoom in.
        const centreX = (viewport / 2 - offset.x) / scale;
        const centreY = (viewport / 2 - offset.y) / scale;

        setZoom(nextZoom);
        setOffset({
            x: clamp(viewport / 2 - centreX * nextScale, viewport - nextWidth, 0),
            y: clamp(viewport / 2 - centreY * nextScale, viewport - nextHeight, 0)
        });
    };

    const handlePointerDown = (event: React.PointerEvent) => {
        if (!natural) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        dragOrigin.current = { x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y };
    };

    const handlePointerMove = (event: React.PointerEvent) => {
        const origin = dragOrigin.current;
        if (!origin) return;
        setOffset(clampOffset({
            x: origin.offsetX + (event.clientX - origin.x),
            y: origin.offsetY + (event.clientY - origin.y)
        }));
    };

    const handlePointerUp = (event: React.PointerEvent) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        dragOrigin.current = null;
    };

    const handleCrop = () => {
        const image = imageRef.current;
        if (!image || !natural) return;

        // The visible frame maps straight back onto the source image: its
        // top-left in natural pixels is however far the image has been
        // dragged, divided by the scale it's displayed at.
        const sourceSize = viewport / scale;
        const sourceX = clamp(-offset.x / scale, 0, natural.width - sourceSize);
        const sourceY = clamp(-offset.y / scale, 0, natural.height - sourceSize);
        const outputSize = Math.round(Math.min(MAX_OUTPUT_SIZE, sourceSize));

        const canvas = document.createElement("canvas");
        canvas.width = outputSize;
        canvas.height = outputSize;
        const context = canvas.getContext("2d");
        if (!context) {
            toast.error(t("profile.crop.failed"));
            return;
        }
        // JPEG has no alpha, so a transparent PNG would otherwise come out
        // with a black background instead of a white one.
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, outputSize, outputSize);
        context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, outputSize, outputSize);

        canvas.toBlob(blob => {
            if (!blob) {
                toast.error(t("profile.crop.failed"));
                return;
            }
            const baseName = file.name.replace(/\.[^.]+$/, "") || "avatar";
            onCropped(new File([blob], `${baseName}-cropped.jpg`, { type: "image/jpeg" }));
        }, "image/jpeg", 0.92);
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-gray-800">
                <div className="flex items-center justify-between border-b p-4 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t("profile.crop.title")}</h2>
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={busy}
                        className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                        aria-label={t("profile.crop.close")}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex flex-col items-center gap-4 p-4">
                    <div
                        style={{ width: viewport, height: viewport }}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        className="relative touch-none overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
                    >
                        {objectUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                ref={imageRef}
                                src={objectUrl}
                                alt={t("profile.crop.preview")}
                                onLoad={handleImageLoad}
                                draggable={false}
                                style={{
                                    width: displayWidth || undefined,
                                    height: displayHeight || undefined,
                                    transform: `translate(${offset.x}px, ${offset.y}px)`
                                }}
                                className="absolute left-0 top-0 max-w-none select-none"
                            />
                        )}
                    </div>

                    <label className="flex w-full items-center gap-3 text-sm text-muted-foreground">
                        {t("profile.crop.zoom")}
                        <input
                            type="range"
                            min={1}
                            max={MAX_ZOOM}
                            step={0.01}
                            value={zoom}
                            disabled={!natural || busy}
                            onChange={event => handleZoomChange(Number(event.target.value))}
                            className="flex-1"
                            aria-label={t("profile.crop.zoom")}
                        />
                    </label>

                    <p className="text-center text-xs text-muted-foreground">
                        {t("profile.crop.hint")}
                    </p>
                </div>

                <div className="flex flex-col gap-2 border-t p-4 dark:border-gray-700 sm:flex-row">
                    <button
                        type="button"
                        onClick={onSkip}
                        disabled={busy}
                        className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                        {t("profile.crop.skip")}
                    </button>
                    <button
                        type="button"
                        onClick={handleCrop}
                        disabled={!natural || busy}
                        className="flex-1 rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {t("profile.crop.upload")}
                    </button>
                </div>
            </div>
        </div>
    );
}
