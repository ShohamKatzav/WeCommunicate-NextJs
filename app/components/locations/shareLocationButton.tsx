'use client';
import { RefObject, useState } from 'react';
import { MapPin } from 'lucide-react';
import { toast } from 'sonner';
import ChatUser from '@/types/chatUser';
import MessageLocation from '@/types/messageLocation';
import useIsMobile from '../../hooks/useIsMobile';

interface ShareLocationButtonProps {
    participants: RefObject<ChatUser[] | null | undefined>;
    onShare: (location: MessageLocation) => Promise<void>;
    disabled?: boolean;
}

// One-shot, unlike useLocation's continuous watch: that hook exists to keep
// the /locations map up to date and emits 'save location' on every fix, so
// mounting it here would start broadcasting a user's live position to that
// map just because they opened a chat. Sharing a pin is a single deliberate
// act, so it reads a single fix and nothing else.
const getCurrentPosition = () => new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000
    });
});

const errorMessage = (error: GeolocationPositionError) => {
    switch (error.code) {
        case error.PERMISSION_DENIED:
            return "Location permission is blocked. Allow location access for this site to share your pin.";
        case error.POSITION_UNAVAILABLE:
            return "Your location isn't available right now. Try again in a moment.";
        case error.TIMEOUT:
            return "Getting your location took too long. Try again.";
        default:
            return "Couldn't get your location. Try again.";
    }
};

const ShareLocationButton = ({ participants, onShare, disabled }: ShareLocationButtonProps) => {
    const isMobile = useIsMobile();
    const [locating, setLocating] = useState(false);

    const handleClick = async () => {
        if (!participants.current?.length) return;
        if (!navigator.geolocation) {
            toast.error("This browser can't share a location.");
            return;
        }

        setLocating(true);
        try {
            const position = await getCurrentPosition();
            // Never send a pin we don't actually have - an empty or partial
            // fix would persist a bubble pointing at nothing.
            if (!Number.isFinite(position.coords.latitude) || !Number.isFinite(position.coords.longitude)) {
                toast.error("Your location isn't available right now. Try again in a moment.");
                return;
            }
            await onShare({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            });
        } catch (error) {
            toast.error(errorMessage(error as GeolocationPositionError));
        } finally {
            setLocating(false);
        }
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={disabled || locating || !participants.current}
            aria-label="Share my location"
            title="Share my location"
            className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
        >
            {locating
                ? <span
                    style={{ width: isMobile ? 25 : 30, height: isMobile ? 25 : 30 }}
                    className="block animate-spin rounded-full border-2 border-current border-r-transparent"
                />
                : <MapPin size={isMobile ? 25 : 30} />}
        </button>
    );
};

export default ShareLocationButton;
