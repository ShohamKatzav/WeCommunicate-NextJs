import { ReactNode } from "react";
import { X } from "lucide-react";
import { useT } from "../../i18n/client";

interface PromptAction {
    label: string;
    onClick: () => void;
}

interface PromptBarProps {
    icon: ReactNode;
    message: string;
    primaryAction?: PromptAction;
    secondaryAction?: PromptAction;
    onDismiss: () => void;
    dismissLabel: string;
    /** How many other prompts are waiting behind this one - see usePromptSlot. */
    queuedCount: number;
    /** Background/text colour for this prompt; layout stays identical across prompts. */
    accentClassName: string;
}

// Shared chrome for every bottom prompt: one slim, full-bleed row instead of
// a floating card, so N stacked prompts never cost more height than one of
// them (BottomPromptStack only ever renders the front of the queue - see
// usePromptSlot). The message wraps (capped at three lines) rather than
// truncating: on a narrow phone a single-line ellipsis cut instructions like
// "tap Share, then Add to Home Screen" off mid-sentence with no way to read
// the rest, and this bar has no tooltip or expand affordance on touch.
export default function PromptBar({
    icon,
    message,
    primaryAction,
    secondaryAction,
    onDismiss,
    dismissLabel,
    queuedCount,
    accentClassName,
}: PromptBarProps) {
    const t = useT();
    return (
        <div className={`pointer-events-auto w-full ${accentClassName}`}>
            <div className="mx-auto flex max-w-4xl items-center gap-3 px-3 py-2.5 sm:px-4">
                <span className="shrink-0" aria-hidden="true">{icon}</span>
                <p className="min-w-0 flex-1 line-clamp-3 break-words text-sm font-medium leading-snug">{message}</p>
                {queuedCount > 0 && (
                    <span className="hidden shrink-0 rounded-full bg-black/15 px-2 py-0.5 text-xs font-semibold sm:inline-block">
                        {t("prompts.more", { count: queuedCount })}
                    </span>
                )}
                {secondaryAction && (
                    <button
                        type="button"
                        onClick={secondaryAction.onClick}
                        // min-h/min-w keep the tap target at 44px even though the
                        // visible label is smaller - shrinking the label without
                        // shrinking the target that WCAG 2.5.5 asks for.
                        className="flex min-h-11 shrink-0 items-center px-1.5 text-sm font-medium underline-offset-2 hover:underline"
                    >
                        {secondaryAction.label}
                    </button>
                )}
                {primaryAction && (
                    <button
                        type="button"
                        onClick={primaryAction.onClick}
                        className="min-h-11 shrink-0 rounded-md bg-white/95 px-3 text-sm font-semibold text-gray-900 transition hover:bg-white"
                    >
                        {primaryAction.label}
                    </button>
                )}
                <button
                    type="button"
                    onClick={onDismiss}
                    aria-label={dismissLabel}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-black/10"
                >
                    <X className="h-4 w-4" aria-hidden="true" />
                </button>
            </div>
        </div>
    );
}
