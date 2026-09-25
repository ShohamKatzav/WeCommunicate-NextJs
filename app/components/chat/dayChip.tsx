import { formatDayLabel } from "../../utils/dayLabel";
import useLocalDay from "../../hooks/useLocalDay";
import { useT } from "../../i18n/client";

// Marks where a new calendar day starts in the message list. A full-width
// centred row of its own, outside any bubble, so it never shifts the
// sent/received alignment of the messages around it.
const DayChip = ({ date }: { date: string | Date }) => {
    // Re-renders at midnight, so "Today" becomes "Yesterday" without a reload.
    const today = useLocalDay();
    const t = useT();

    return (
        <div className="my-3 flex justify-center" data-testid="day-chip">
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-muted-foreground dark:bg-gray-700">
                {formatDayLabel(date, t, today)}
            </span>
        </div>
    );
};

export default DayChip;
