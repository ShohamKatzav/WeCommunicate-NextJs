// How a call ended, from the server's point of view (see recordCall in
// socket/handlers.ts). The wording each side sees is worked out when it's
// displayed (app/utils/callRecord.ts) - the same record is "No answer" for
// the caller and "Missed call" for the callee.
export type CallOutcome =
    | 'completed'
    | 'no-answer'
    | 'cancelled'
    | 'declined'
    | 'busy'
    | 'failed';

export const CALL_OUTCOMES: CallOutcome[] = ['completed', 'no-answer', 'cancelled', 'declined', 'busy', 'failed'];

// The callee never picked up - counted as unread for them, like a message.
export const MISSED_CALL_OUTCOMES: CallOutcome[] = ['no-answer', 'cancelled', 'busy'];

// A call-history entry in a conversation. The message's sender is always the
// caller.
export default interface MessageCall {
    video: boolean;
    outcome: CallOutcome;
    // From answer to hang-up; 0 for a call that was never answered.
    durationSeconds: number;
}
