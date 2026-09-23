// Wording for getUserMedia failures. A video call asks for a camera and a
// microphone in one request, and the browser error name (NotFoundError,
// NotAllowedError, …) does not say which of those devices actually failed.
// These helpers name only the device the attempt needed and could not use.

export type MediaDeviceName = 'camera' | 'microphone';

export type MediaRequest = {
    audio: boolean;
    video: boolean;
};

export type MediaDevicePresence = {
    hasMicrophone: boolean;
    hasCamera: boolean;
};

export function requestedDeviceNames(request: MediaRequest): MediaDeviceName[] {
    const names: MediaDeviceName[] = [];
    if (request.video) names.push('camera');
    if (request.audio) names.push('microphone');
    return names.length > 0 ? names : ['microphone'];
}

export function missingDeviceNames(request: MediaRequest, presence: MediaDevicePresence): MediaDeviceName[] {
    const missing: MediaDeviceName[] = [];
    if (request.video && !presence.hasCamera) missing.push('camera');
    if (request.audio && !presence.hasMicrophone) missing.push('microphone');
    return missing;
}

// Button title and the incoming-call notice. Null when every device this
// attempt needs is already present.
export function unavailableDevicesReason(request: MediaRequest, presence: MediaDevicePresence): string | null {
    const missing = missingDeviceNames(request, presence);
    if (missing.length === 0) return null;
    return notFoundSentence(missing, false);
}

function notFoundSentence(devices: MediaDeviceName[], period: boolean): string {
    const end = period ? '.' : '';
    if (devices.length >= 2) {
        return `No camera and no microphone were found on this device${end}`;
    }
    return `No ${devices[0]} was found on this device${end}`;
}

function deviceList(devices: MediaDeviceName[]): string {
    if (devices.length >= 2) return 'camera and microphone';
    return devices[0] ?? 'microphone';
}

function permissionSentence(devices: MediaDeviceName[]): string {
    return `Allow access to your ${deviceList(devices)} in the browser's site settings to make calls.`;
}

function busySentence(devices: MediaDeviceName[]): string {
    if (devices.length >= 2) return 'Your camera and microphone are being used by another app.';
    return `Your ${devices[0]} is being used by another app.`;
}

function accessSentence(devices: MediaDeviceName[]): string {
    return `Couldn't access your ${deviceList(devices)}.`;
}

function namedByMessage(error: unknown, request: MediaRequest): MediaDeviceName[] {
    const message = error instanceof DOMException ? error.message.toLowerCase() : '';
    const named: MediaDeviceName[] = [];
    if (request.video && /\b(video|camera)\b/.test(message)) named.push('camera');
    if (request.audio && /\b(audio|microphone|mic)\b/.test(message)) named.push('microphone');
    return named;
}

async function readPresence(): Promise<MediaDevicePresence | null> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return null;
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return {
            hasMicrophone: devices.some(device => device.kind === 'audioinput'),
            hasCamera: devices.some(device => device.kind === 'videoinput'),
        };
    } catch {
        return null;
    }
}

export async function describeMediaError(error: unknown, request: MediaRequest): Promise<string> {
    const name = error instanceof DOMException ? error.name : '';
    if (name === 'SecurityError' && error instanceof DOMException && /https|secure/i.test(error.message)) {
        return 'Calls need a secure (https) page.';
    }

    const requested = requestedDeviceNames(request);

    // NotFoundError (and some cameras' OverconstrainedError) covers "this
    // kind of device does not exist". Ask the browser which kinds are
    // actually plugged in and name only those.
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
        const presence = await readPresence();
        if (presence) {
            const missing = missingDeviceNames(request, presence);
            if (missing.length > 0) return notFoundSentence(missing, true);
            // The hardware is listed, so this was a constraint or a device
            // that disappeared between the check and the request. Video
            // constraints are the only ones that get retried, so an
            // OverconstrainedError that still fails is the camera.
            if (name === 'OverconstrainedError' && request.video) return accessSentence(['camera']);
            const named = namedByMessage(error, request);
            return accessSentence(named.length > 0 ? named : requested);
        }
        return notFoundSentence(requested, true);
    }

    const named = namedByMessage(error, request);
    const devices = named.length > 0 ? named : requested;

    switch (name) {
        case 'NotAllowedError':
        case 'PermissionDeniedError':
        case 'SecurityError':
            return permissionSentence(devices);
        case 'NotReadableError':
        case 'TrackStartError':
        case 'AbortError':
            return busySentence(devices);
        default:
            return accessSentence(devices);
    }
}
