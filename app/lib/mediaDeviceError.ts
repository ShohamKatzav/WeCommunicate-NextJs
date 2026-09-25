// Wording for getUserMedia failures. A video call asks for a camera and a
// microphone in one request, and the browser error name (NotFoundError,
// NotAllowedError, …) does not say which of those devices actually failed.
// These helpers name only the device the attempt needed and could not use.
// Each device combination has its own whole sentence in the catalog rather
// than "your " + device name: other languages inflect the device names.

import type { TFunction } from '../i18n/messages';

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
export function unavailableDevicesReason(request: MediaRequest, presence: MediaDevicePresence, t: TFunction): string | null {
    const missing = missingDeviceNames(request, presence);
    if (missing.length === 0) return null;
    return notFoundSentence(missing, false, t);
}

// Which of the "both / camera / microphone" sentences a device list needs.
const which = (devices: MediaDeviceName[]): 'Both' | 'Camera' | 'Microphone' =>
    devices.length >= 2 ? 'Both' : devices[0] === 'camera' ? 'Camera' : 'Microphone';

function notFoundSentence(devices: MediaDeviceName[], period: boolean, t: TFunction): string {
    const sentence = t(`media.notFound${which(devices)}`);
    return period ? `${sentence}.` : sentence;
}

function permissionSentence(devices: MediaDeviceName[], t: TFunction): string {
    return t(`media.permission${which(devices)}`);
}

function busySentence(devices: MediaDeviceName[], t: TFunction): string {
    return t(`media.busy${which(devices)}`);
}

function accessSentence(devices: MediaDeviceName[], t: TFunction): string {
    return t(`media.access${which(devices)}`);
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

export async function describeMediaError(error: unknown, request: MediaRequest, t: TFunction): Promise<string> {
    const name = error instanceof DOMException ? error.name : '';
    if (name === 'SecurityError' && error instanceof DOMException && /https|secure/i.test(error.message)) {
        return t('media.secure');
    }

    const requested = requestedDeviceNames(request);

    // NotFoundError (and some cameras' OverconstrainedError) covers "this
    // kind of device does not exist". Ask the browser which kinds are
    // actually plugged in and name only those.
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
        const presence = await readPresence();
        if (presence) {
            const missing = missingDeviceNames(request, presence);
            if (missing.length > 0) return notFoundSentence(missing, true, t);
            // The hardware is listed, so this was a constraint or a device
            // that disappeared between the check and the request. Video
            // constraints are the only ones that get retried, so an
            // OverconstrainedError that still fails is the camera.
            if (name === 'OverconstrainedError' && request.video) return accessSentence(['camera'], t);
            const named = namedByMessage(error, request);
            return accessSentence(named.length > 0 ? named : requested, t);
        }
        return notFoundSentence(requested, true, t);
    }

    const named = namedByMessage(error, request);
    const devices = named.length > 0 ? named : requested;

    switch (name) {
        case 'NotAllowedError':
        case 'PermissionDeniedError':
        case 'SecurityError':
            return permissionSentence(devices, t);
        case 'NotReadableError':
        case 'TrackStartError':
        case 'AbortError':
            return busySentence(devices, t);
        default:
            return accessSentence(devices, t);
    }
}
