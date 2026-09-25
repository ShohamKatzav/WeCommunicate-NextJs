"use client"
import { Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Video } from "lucide-react";
import MessageCall from "@/types/messageCall";
import { describeCallRecord } from "../../utils/callRecord";
import { useT } from "../../i18n/client";

interface CallRecordRowProps {
    call: MessageCall;
    isCaller: boolean;
    date?: Date;
}

// A call in the conversation's history - a centred line in the transcript
// rather than a bubble from either side, and without reply/react/delete:
// it's a record of something that happened, not something anyone said.
const CallRecordRow = ({ call, isCaller, date }: CallRecordRowProps) => {
    const t = useT();
    const { label, detail, missed } = describeCallRecord(call, isCaller, t);
    const Icon = missed
        ? PhoneMissed
        : call.video
            ? Video
            : call.outcome === 'completed'
                ? (isCaller ? PhoneOutgoing : PhoneIncoming)
                : Phone;
    const time = date
        ? new Date(date).toLocaleTimeString(t.dateLocale, { hour: "2-digit", minute: "2-digit", hour12: false })
        : null;

    return (
        <div className="my-2 flex justify-center" data-testid="call-record">
            <div
                className={`flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${missed
                    ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300"
                    : "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                    }`}
            >
                <Icon size={16} aria-hidden="true" className="shrink-0" />
                <span className="truncate font-medium">{label}</span>
                {detail && <span className="shrink-0 tabular-nums">· {detail}</span>}
                {time && (
                    <time
                        dateTime={new Date(date!).toISOString()}
                        className={`shrink-0 text-xs tabular-nums ${missed ? "text-red-600 dark:text-red-300" : "text-gray-500 dark:text-gray-400"}`}
                    >
                        {time}
                    </time>
                )}
            </div>
        </div>
    );
};

export default CallRecordRow;
