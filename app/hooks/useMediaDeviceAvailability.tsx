import { useEffect, useState } from 'react';
import type { MediaDevicePresence } from '../lib/mediaDeviceError';

// getUserMedia already surfaces a missing microphone or camera as a rejected
// promise (see describeMediaError in mediaDeviceError.ts) - but only after
// the caller has already started ringing, or only after the callee has
// tapped Accept and the call auto-declines. Checking device presence up
// front lets the call buttons themselves name the device that is missing.
//
// enumerateDevices() doesn't need permission to report whether an
// audioinput or videoinput exists at all - only the device labels are
// hidden without permission - and it never itself prompts for permission.
const useMediaDeviceAvailability = (): MediaDevicePresence => {
    // Defaults to available: a browser that can't enumerate devices (or just
    // hasn't returned a result yet) still gets the normal call flow, which
    // already names a genuinely missing device via getUserMedia's own
    // rejection. Failing open here only means falling back to that check,
    // never silently blocking calling on a browser this can't read.
    const [availability, setAvailability] = useState<MediaDevicePresence>({
        hasMicrophone: true,
        hasCamera: true,
    });

    useEffect(() => {
        if (!navigator.mediaDevices?.enumerateDevices) return;
        let cancelled = false;

        const check = async () => {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                if (!cancelled) {
                    setAvailability({
                        hasMicrophone: devices.some(device => device.kind === 'audioinput'),
                        hasCamera: devices.some(device => device.kind === 'videoinput'),
                    });
                }
            } catch {
                // Leave the existing (available) state - see the default above.
            }
        };

        check();
        // Keeps this live if a mic, camera, or headset is unplugged or
        // plugged in while the chat is open, without polling.
        navigator.mediaDevices.addEventListener?.('devicechange', check);
        return () => {
            cancelled = true;
            navigator.mediaDevices.removeEventListener?.('devicechange', check);
        };
    }, []);

    return availability;
};

export default useMediaDeviceAvailability;
