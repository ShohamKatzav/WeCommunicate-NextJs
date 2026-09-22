"use client"
import { useEffect, useMemo } from 'react';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { X, ExternalLink, MapPin } from 'lucide-react';
import MessageLocation from '@/types/messageLocation';

interface FullscreenLocationViewerProps {
    location: MessageLocation;
    onClose: () => void;
}

const containerStyle = { width: '100%', height: '100%' };

// Unlike the bubble's own thumbnail (locationBubble.tsx), this map is left
// fully interactive - default UI, pan and zoom - since it's the dedicated
// full-screen view rather than a preview. Opening Google Maps itself stays a
// secondary, explicit action here rather than what a tap on the bubble does.
const FullscreenLocationViewer = ({ location, onClose }: FullscreenLocationViewerProps) => {
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!
    });

    const center = useMemo(
        () => ({ lat: location.latitude, lng: location.longitude }),
        [location.latitude, location.longitude]
    );
    const pinUrl = `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;

    useEffect(() => {
        document.body.style.overflow = 'hidden';

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.body.style.overflow = 'unset';
            document.removeEventListener('keydown', handleEscape);
        };
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-9999 flex flex-col bg-black"
            onClick={onClose}
        >
            {/* Black chrome around the map, matching the media viewer's
                letterbox. The close control lives on that black bar so it
                never sits on top of the map tiles. */}
            <div className="flex shrink-0 items-center justify-end px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 md:px-4">
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full bg-white/15 p-2 ring-2 ring-white/80 transition-colors hover:bg-white/25"
                    aria-label="Close fullscreen"
                >
                    <X size={32} color="red" />
                </button>
            </div>

            <div className="relative min-h-0 flex-1">
                <div
                    className="absolute inset-x-3 inset-y-0 md:inset-x-6"
                    onClick={(event) => event.stopPropagation()}
                >
                    {isLoaded ? (
                        <GoogleMap mapContainerStyle={containerStyle} center={center} zoom={16}>
                            <Marker position={center} />
                        </GoogleMap>
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <MapPin size={64} className="text-white/60" aria-hidden="true" />
                        </div>
                    )}
                </div>
            </div>

            <div className="flex shrink-0 flex-col items-center gap-2 px-4 py-4">
                <a
                    href={pinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-lg transition-colors hover:bg-gray-100"
                >
                    <ExternalLink size={16} aria-hidden="true" />
                    Open in Google Maps
                </a>
                <div className="text-sm text-white/70 md:hidden">
                    Tap outside to close
                </div>
            </div>
        </div>
    );
};

export default FullscreenLocationViewer;
