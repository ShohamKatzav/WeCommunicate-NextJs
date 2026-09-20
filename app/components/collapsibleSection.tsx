import { ChevronDown } from "lucide-react";
import { ReactNode } from "react";

interface CollapsibleSectionProps {
    title: string;
    teaser: string;
    children: ReactNode;
    defaultOpen?: boolean;
}

// Native <details>/<summary> rather than useState: no client JS, keyboard and
// screen-reader accessible for free, and the collapsed content still lives in
// the DOM so it stays searchable/indexable.
export default function CollapsibleSection({ title, teaser, children, defaultOpen = false }: CollapsibleSectionProps) {
    return (
        <details
            open={defaultOpen}
            className="group bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-300 dark:border-gray-700 overflow-hidden"
        >
            <summary className="flex items-center justify-between gap-4 cursor-pointer list-none p-6 sm:p-7 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors [&::-webkit-details-marker]:hidden">
                <div className="min-w-0">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                        {title}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {teaser}
                    </p>
                </div>
                <ChevronDown
                    className="w-5 h-5 shrink-0 text-gray-400 transition-transform duration-200 group-open:rotate-180"
                    aria-hidden="true"
                />
            </summary>
            {/* The divider plus its own top padding keeps expanded content from
                looking glued to the teaser above it, and matches the summary's
                horizontal padding so everything lines up on both axes.
                Bottom padding is deliberately larger than the summary's own:
                text against a hard card edge reads tighter than the same gap
                between two text blocks, so matching it exactly made expanded
                sections look clipped. */}
            <div className="px-6 sm:px-7 pb-8 sm:pb-9">
                <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
                    {children}
                </div>
            </div>
        </details>
    );
}
