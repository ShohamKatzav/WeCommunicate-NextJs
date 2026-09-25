'use client';
import { RefObject, useState } from 'react';
import { MapPin } from 'lucide-react';
import { toast } from 'sonner';
import ChatUser from '@/types/chatUser';
import MessageLocation from '@/types/messageLocation';
import useIsMobile from '../../hooks/useIsMobile';
import { useT } from '../../i18n/client';
import type { TFunction } from '../../i18n/messages';

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

const errorMessage = (error: GeolocationPositionError, t: TFunction) => {
    switch (error.code) {
        case error.PERMISSION_DENIED:
            return t("locations.share.denied");
        case error.POSITION_UNAVAILABLE:
            return t("locations.share.unavailable");
        case error.TIMEOUT:
            return t("locations.share.timeout");
        default:
            return t("locations.share.failed");
    }
};

const ShareLocationButton = ({ participants, onShare, disabled }: ShareLocationButtonProps) => {
    const isMobile = useIsMobile();
    const t = useT();
    const [locating, setLocating] = useState(false);

    const handleClick = async () => {
        if (!participants.current?.length) return;
        if (!navigator.geolocation) {
            toast.error(t("locations.share.unsupported"));
            return;
        }

        setLocating(true);
        try {
            const position = await getCurrentPosition();
            // Never send a pin we don't actually have - an empty or partial
            // fix would persist a bubble pointing at nothing.
            if (!Number.isFinite(position.coords.latitude) || !Number.isFinite(position.coords.longitude)) {
                toast.error(t("locations.share.unavailable"));
                return;
            }
            await onShare({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            });
        } catch (error) {
            toast.error(errorMessage(error as GeolocationPositionError, t));
        } finally {
            setLocating(false);
        }
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={disabled || locating || !participants.current}
            aria-label={t("locations.share.label")}
            title={t("locations.share.label")}
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
