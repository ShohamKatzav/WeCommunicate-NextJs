"use client";
import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Bug, X } from "lucide-react";
import { toast } from "sonner";
import { useT } from "../../i18n/client";
import BugReportLauncher from "./bugReportLauncher";
import "./bugReport.css";

// Hiding the pill is the person's choice, for this browser session only
// (sessionStorage). The in-memory flag covers storage that throws (private
// modes, blocked site data).
const HIDDEN_KEY = "bug-report-pill-hidden";
let hiddenThisSession = false;
const hiddenListeners = new Set<() => void>();
const subscribeHidden = (onChange: () => void) => {
    hiddenListeners.add(onChange);
    return () => { hiddenListeners.delete(onChange); };
};
const isHidden = () => {
    if (hiddenThisSession) return true;
    try {
        return sessionStorage.getItem(HIDDEN_KEY) === "1";
    } catch {
        return false;
    }
};
const hideForSession = () => {
    hiddenThisSession = true;
    try {
        sessionStorage.setItem(HIDDEN_KEY, "1");
    } catch { }
    hiddenListeners.forEach(listener => listener());
};

// The always-there way to report a bug. Two exceptions: /contact, whose own
// "Something broke?" card already is one, and an open conversation on a
// phone, where the conversation's ⋯ menu carries it (chatDropdown.tsx) and
// bugReport.css hides this. Where it sits is all in bugReport.css. The x
// hides it for the rest of the session; the ⋯ menu item and the contact
// page's card stay.
export default function ReportBugButton() {
    const t = useT();
    const pathname = usePathname() || "";
    const hidden = useSyncExternalStore(subscribeHidden, isHidden, () => false);
    const onChat = pathname === "/chat" || pathname.startsWith("/chat/");
    if (pathname === "/contact" || hidden) return null;

    return (
        // One capsule, two buttons: the pill opens the form, the x hides it.
        <div
            data-on-chat={onChat || undefined}
            className="bug-report-fab inline-flex items-center rounded-full border border-pink-200 bg-white/95 shadow-lg shadow-pink-500/15 backdrop-blur-sm transition-[translate,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-pink-300 hover:shadow-xl hover:shadow-pink-500/25 motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:border-pink-400/30 dark:bg-gray-800/95 dark:shadow-black/40 dark:hover:border-pink-400/60 dark:hover:shadow-pink-500/20"
        >
            <BugReportLauncher
                source="button"
                className="bug-report-wiggle group inline-flex min-h-11 items-center gap-2 rounded-full py-1.5 ps-1.5 pe-2 text-sm font-semibold text-gray-800 transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:text-gray-100"
            >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pink-100 text-pink-600 transition-colors group-hover:bg-pink-200 dark:bg-pink-500/20 dark:text-pink-300 dark:group-hover:bg-pink-500/30">
                    <Bug className="bug-report-wiggle-icon h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <span className="whitespace-nowrap">{t("bugReport.button")}</span>
            </BugReportLauncher>
            <button
                type="button"
                onClick={() => {
                    hideForSession();
                    toast(t("bugReport.hiddenNotice"));
                }}
                aria-label={t("bugReport.hideButton")}
                title={t("bugReport.hideButton")}
                className="me-1 flex h-9 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500"
            >
                <X className="h-4 w-4" aria-hidden="true" />
            </button>
        </div>
    );
}
