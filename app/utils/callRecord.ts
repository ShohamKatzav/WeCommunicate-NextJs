import MessageCall from '@/types/messageCall';
import type { TFunction } from '../i18n/messages';

export interface CallRecordText {
    label: string;
    // Duration, or why the call didn't happen - shown after the label.
    detail?: string;
    // Shown in red, like a missed call in a phone's call log.
    missed: boolean;
}

export const formatCallDuration = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const mmss = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    return hours > 0 ? `${hours}:${mmss}` : mmss;
};

// The same stored outcome reads differently for each side - a call the
// caller gave up on is still a missed call for the person they called.
// One whole phrase per case rather than "Missed" + "video" + "call": other
// languages don't build it in that order.
export function describeCallRecord(call: MessageCall, isCaller: boolean, t: TFunction): CallRecordText {
    const video = call.video;
    const plainCall = video ? t('calls.record.videoCall') : t('calls.record.voiceCall');
    const missedCall = video ? t('calls.record.missedVideo') : t('calls.record.missedVoice');

    switch (call.outcome) {
        case 'completed':
            return {
                label: isCaller
                    ? (video ? t('calls.record.outgoingVideo') : t('calls.record.outgoingVoice'))
                    : (video ? t('calls.record.incomingVideo') : t('calls.record.incomingVoice')),
                detail: formatCallDuration(call.durationSeconds),
                missed: false,
            };
        case 'declined':
            return isCaller
                ? { label: plainCall, detail: t('calls.record.declined'), missed: false }
                : { label: video ? t('calls.record.declinedVideo') : t('calls.record.declinedVoice'), missed: false };
        case 'failed':
            return { label: plainCall, detail: t('calls.record.couldntConnect'), missed: false };
        case 'no-answer':
            return isCaller
                ? { label: plainCall, detail: t('calls.record.noAnswer'), missed: false }
                : { label: missedCall, missed: true };
        case 'busy':
            return isCaller
                ? { label: plainCall, detail: t('calls.record.busy'), missed: false }
                : { label: missedCall, missed: true };
        case 'cancelled':
        default:
            return isCaller
                ? { label: video ? t('calls.record.cancelledVideo') : t('calls.record.cancelledVoice'), missed: false }
                : { label: missedCall, missed: true };
    }
}

export const callRecordSummary = (call: MessageCall, isCaller: boolean, t: TFunction) => {
    const { label, detail } = describeCallRecord(call, isCaller, t);
    return detail ? `${label} · ${detail}` : label;
};
