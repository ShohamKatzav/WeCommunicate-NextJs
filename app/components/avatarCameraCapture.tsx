"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, X } from "lucide-react";

type CameraMode = "none" | "native" | "desktop";

interface AvatarCameraCaptureProps {
    onCapture: (file: File) => void;
    disabled?: boolean;
}

// Detected once on mount, client-side only - starting at "none" keeps the
// first client render identical to the server render (no button) so this
// never causes a hydration mismatch.
function useCameraMode(): CameraMode {
    const [mode, setMode] = useState<CameraMode>("none");

    useEffect(() => {
        const detectMode = () => {
            if (typeof window === "undefined" || !window.matchMedia) return;

            // Coarse pointer = touch device: the OS camera app (opened via
            // the file input's capture attribute) is both the only option
            // and the better UX there, so it takes priority over the
            // desktop branch even on a touch device that also happens to
            // expose getUserMedia.
            if (window.matchMedia("(pointer: coarse)").matches) {
                setMode("native");
                return;
            }
            if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
            setMode("desktop");
        };
        detectMode();
    }, []);

    return mode;
}

const triggerButtonClass =
    "absolute bottom-0 left-0 p-1.5 rounded-full bg-primary text-primary-foreground cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed";

export default function AvatarCameraCapture({ onCapture, disabled }: AvatarCameraCaptureProps) {
    const mode = useCameraMode();
    const nativeInputRef = useRef<HTMLInputElement>(null);
    const [previewOpen, setPreviewOpen] = useState(false);

    if (mode === "none") return null;

    if (mode === "native") {
        return (
            <>
                <label
                    htmlFor="avatar-take-photo"
                    className={triggerButtonClass}
                    aria-label="Take photo"
                >
                    <Camera size={16} />
                </label>
                <input
                    id="avatar-take-photo"
                    ref={nativeInputRef}
                    type="file"
                    accept="image/*"
                    capture="user"
                    className="hidden"
                    disabled={disabled}
                    onChange={() => {
                        const file = nativeInputRef.current?.files?.[0];
                        if (nativeInputRef.current) nativeInputRef.current.value = "";
                        if (file) onCapture(file);
                    }}
                />
            </>
        );
    }

    return (
        <>
            <button
                type="button"
                className={triggerButtonClass}
                aria-label="Take photo"
                disabled={disabled}
                onClick={() => setPreviewOpen(true)}
            >
                <Camera size={16} />
            </button>
            {previewOpen && (
                <DesktopCameraPreview
                    onCapture={(file) => {
                        setPreviewOpen(false);
                        onCapture(file);
                    }}
                    onClose={() => setPreviewOpen(false)}
                />
            )}
        </>
    );
}

// getUserMedia rejects with a DOMException whose `name` distinguishes "no
// camera on this machine" from "camera exists but access was refused" -
// collapsing both into one permissions-flavored message (as a generic catch
// would) is actively misleading on a desktop with no webcam at all.
function cameraErrorMessage(err: unknown): string {
    const name = err instanceof DOMException ? err.name : undefined;
    switch (name) {
        case "NotFoundError":
        case "DevicesNotFoundError":
        case "OverconstrainedError":
            return "No camera found on this device.";
        case "NotAllowedError":
        case "PermissionDeniedError":
        case "SecurityError":
            return "Camera access was denied. Check your browser permissions.";
        case "NotReadableError":
        case "TrackStartError":
            return "The camera is already in use by another app.";
        default:
            return "Couldn't access the camera. Please try again.";
    }
}

function DesktopCameraPreview({ onCapture, onClose }: { onCapture: (file: File) => void; onClose: () => void }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
                if (cancelled) {
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }
                streamRef.current = stream;
                if (videoRef.current) videoRef.current.srcObject = stream;
                setReady(true);
            } catch (err) {
                console.error("Failed to open camera:", err);
                if (!cancelled) {
                    toast.error(cameraErrorMessage(err));
                    onClose();
                }
            }
        })();

        return () => {
            cancelled = true;
            streamRef.current?.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleShutter = () => {
        const video = videoRef.current;
        if (!video || !video.videoWidth || !video.videoHeight) return;

        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0);

        canvas.toBlob(blob => {
            if (!blob) {
                toast.error("Couldn't capture that photo. Please try again.");
                return;
            }
            onCapture(new File([blob], `avatar-${Date.now()}.jpg`, { type: "image/jpeg" }));
        }, "image/jpeg", 0.9);
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
                <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Take photo</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-4 flex flex-col items-center gap-4">
                    <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-black">
                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            playsInline
                            className="w-full h-full object-cover -scale-x-100"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={handleShutter}
                        disabled={!ready}
                        aria-label="Capture photo"
                        className="p-4 rounded-full bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Camera size={28} />
                    </button>
                </div>
            </div>
        </div>
    );
}
