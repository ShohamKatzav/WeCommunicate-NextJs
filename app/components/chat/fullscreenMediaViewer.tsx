
"use client"
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { X, Loader2 } from 'lucide-react';
import { useT } from '../../i18n/client';

interface FullscreenMediaViewerProps {
    src: string;
    onClose: () => void;
}

const FullscreenMediaViewer = ({ src, onClose }: FullscreenMediaViewerProps) => {
    const t = useT();
    const containerRef = useRef<HTMLDivElement>(null);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        // Prevent body scroll when fullscreen is open
        document.body.style.overflow = 'hidden';

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);

        return () => {
            document.body.style.overflow = 'unset';
            document.removeEventListener('keydown', handleEscape);
        };
    }, [onClose]);

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 z-9999 bg-black flex items-center justify-center"
            onClick={onClose}
        >
            <button
                onClick={onClose}
                className="absolute top-4 end-4 z-10000 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
                aria-label={t("chat.fullscreen.close")}
            >
                <X size={32} color="red" />
            </button>

            <div
                className="w-full h-full flex items-center justify-center"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="relative w-full h-full">
                    {!loaded && (
                        <div
                            className="absolute inset-0 flex items-center justify-center"
                            aria-label={t("chat.fullscreen.loadingImage")}
                        >
                            <Loader2 size={48} className="animate-spin text-white/80" />
                        </div>
                    )}
                    <Image
                        src={src}
                        alt={t("chat.fullscreen.image")}
                        fill
                        style={{ objectFit: 'contain', opacity: loaded ? 1 : 0 }}
                        priority
                        onLoad={() => setLoaded(true)}
                    />
                </div>
            </div>

            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white/70 text-sm md:hidden">
                {t("chat.fullscreen.tapToClose")}
            </div>
        </div>
    );
};

export default FullscreenMediaViewer;