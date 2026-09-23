'use client';
import { useEffect, useMemo, useState } from 'react';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { MapPin } from 'lucide-react';
import MessageLocation from '@/types/messageLocation';
import useIsMobile from '../../hooks/useIsMobile';

interface LocationBubbleProps {
    location: MessageLocation;
    // Opens the fullscreen viewer - matches how a photo/video bubble behaves
    // (messageBubble.tsx's handleMediaDoubleClick), not a direct navigation:
    // Google Maps is a secondary action offered *inside* that fullscreen
    // view, not the result of tapping the thumbnail itself.
    onOpen: () => void;
}

declare global {
    interface Window {
        gm_authFailure?: () => void;
    }
}

// Maps announces a rejected key (wrong referrer, billing disabled, quota
// exhausted) by calling this global and painting its own "Oops! Something
// went wrong" panel into every map container. In a page-sized map that's
// fair enough; in a chat bubble it just looks like a broken message, so the
// bubbles fall back to a plain pin instead. Module scope because there is
// one global callback for however many bubbles are on screen.
let mapsAuthFailed = false;
let authFailureHandlerInstalled = false;
const authFailureSubscribers = new Set<() => void>();

const installAuthFailureHandler = () => {
    if (authFailureHandlerInstalled || typeof window === 'undefined') return;
    authFailureHandlerInstalled = true;
    const previousHandler = window.gm_authFailure;
    window.gm_authFailure = () => {
        mapsAuthFailed = true;
        authFailureSubscribers.forEach(notify => notify());
        previousHandler?.();
    };
};

const containerStyle = { width: '100%', height: '100%' };

// Interaction is deliberately off: the preview is a thumbnail, not a second
// map to pan around (that's what /locations is for), and a live map would
// otherwise swallow the tap that's meant to open the pin.
const previewOptions: google.maps.MapOptions = {
    disableDefaultUI: true,
    gestureHandling: 'none',
    keyboardShortcuts: false,
    clickableIcons: false,
    zoomControl: false
};

const LocationBubble = ({ location, onOpen }: LocationBubbleProps) => {
    const isMobile = useIsMobile();
    // Shares the loader id with /locations so the Maps script is fetched
    // once per session no matter which of them mounts first.
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!
    });

    const [authFailed, setAuthFailed] = useState(mapsAuthFailed);

    useEffect(() => {
        installAuthFailureHandler();
        const notify = () => setAuthFailed(true);
        authFailureSubscribers.add(notify);
        return () => { authFailureSubscribers.delete(notify); };
    }, []);

    const center = useMemo(
        () => ({ lat: location.latitude, lng: location.longitude }),
        [location.latitude, location.longitude]
    );

    const label = `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`;

    return (
        <button
            type="button"
            // Same tap semantics as the photo/video bubbles right below this
            // one: double-tap on mobile (a single tap there instead toggles
            // the mobile reply/delete action buttons on the outer bubble -
            // see messageBubble.tsx's own onClick), single click on desktop.
            onDoubleClick={() => { if (isMobile) onOpen(); }}
            onClick={() => { if (!isMobile) onOpen(); }}
            aria-label={`Open shared location ${label} fullscreen`}
            className="relative block w-full max-w-[240px] overflow-hidden rounded-xl border border-white/30 bg-black/10 text-left"
        >
            <div className="h-[110px] w-full md:h-[140px]">
                {isLoaded && !authFailed ? (
                    <GoogleMap
                        mapContainerStyle={containerStyle}
                        center={center}
                        zoom={15}
                        options={previewOptions}
                    >
                        <Marker position={center} />
                    </GoogleMap>
                ) : (
                    <div className="flex h-full w-full items-center justify-center">
                        <MapPin size={28} aria-hidden="true" />
                    </div>
                )}
            </div>
            {/* The map owns every pointer event inside its own canvas, so the
                tap target that actually opens the pin sits above it. */}
            <span className="absolute inset-0" aria-hidden="true" />
            <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-black/45 px-2 py-1 text-xs text-white">
                <MapPin size={12} className="shrink-0" aria-hidden="true" />
                <span className="truncate">{label}</span>
            </span>
        </button>
    );
};

export default LocationBubble;
