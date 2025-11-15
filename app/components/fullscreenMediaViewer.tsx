
"use client"
import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';

interface FullscreenMediaViewerProps {
    src: string;
    onClose: () => void;
}

const FullscreenMediaViewer = ({ src, onClose }: FullscreenMediaViewerProps) => {
    const containerRef = useRef<HTMLDivElement>(null);

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
                className="absolute top-4 right-4 z-10000 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
                aria-label="Close fullscreen"
            >
                <X size={32} color="red" />
            </button>

            <div
                className="w-full h-full flex items-center justify-center"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="relative w-full h-full">
                    <Image
                        src={src}
                        alt="Fullscreen image"
                        fill
                        style={{ objectFit: 'contain' }}
                        priority
                    />
                </div>
            </div>

            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white/70 text-sm md:hidden">
                Tap outside to close
            </div>
        </div>
    );
};

export default FullscreenMediaViewer;