import MessageCall from '@/types/messageCall';

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
export function describeCallRecord(call: MessageCall, isCaller: boolean): CallRecordText {
    const kind = call.video ? 'video' : 'voice';
    const Kind = call.video ? 'Video' : 'Voice';

    switch (call.outcome) {
        case 'completed':
            return {
                label: isCaller ? `Outgoing ${kind} call` : `Incoming ${kind} call`,
                detail: formatCallDuration(call.durationSeconds),
                missed: false,
            };
        case 'declined':
            return isCaller
                ? { label: `${Kind} call`, detail: 'Declined', missed: false }
                : { label: `Declined ${kind} call`, missed: false };
        case 'failed':
            return { label: `${Kind} call`, detail: "Couldn't connect", missed: false };
        case 'no-answer':
            return isCaller
                ? { label: `${Kind} call`, detail: 'No answer', missed: false }
                : { label: `Missed ${kind} call`, missed: true };
        case 'busy':
            return isCaller
                ? { label: `${Kind} call`, detail: 'Busy', missed: false }
                : { label: `Missed ${kind} call`, missed: true };
        case 'cancelled':
        default:
            return isCaller
                ? { label: `Cancelled ${kind} call`, missed: false }
                : { label: `Missed ${kind} call`, missed: true };
    }
}

export const callRecordSummary = (call: MessageCall, isCaller: boolean) => {
    const { label, detail } = describeCallRecord(call, isCaller);
    return detail ? `${label} · ${detail}` : label;
};
