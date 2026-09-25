"use client";
import { UserX } from "lucide-react";
import { useT } from "../../i18n/client";

interface SystemNoticeRowProps {
    date?: Date;
}

// A notice from the app in the message list - so far only "a member deleted
// their account" (AccountDeletionService). Centered like a call record: it
// isn't anyone's message, so it has no bubble, sender or actions.
const SystemNoticeRow = ({ date }: SystemNoticeRowProps) => {
    const t = useT();
    const time = date
        ? new Date(date).toLocaleTimeString(t.dateLocale, { hour: "2-digit", minute: "2-digit", hour12: false })
        : null;

    return (
        <div className="my-2 flex justify-center" data-testid="system-notice">
            <div className="flex max-w-full items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
                <UserX size={16} aria-hidden="true" className="shrink-0" />
                <span className="font-medium wrap-break-word">{t("chat.notice.accountDeleted")}</span>
                {time && (
                    <time dateTime={new Date(date!).toISOString()} className="shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">
                        {time}
                    </time>
                )}
            </div>
        </div>
    );
};

export default SystemNoticeRow;
