"use client";
import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { AlertCircle, Bug, CheckCircle2, ShieldCheck, X } from "lucide-react";
import { useT } from "../../i18n/client";
import { sendBugReport, type BugReportSource } from "../../lib/bugReportActions";
import { BUG_REPORT_MAX_LENGTH, BUG_REPORT_MIN_LENGTH } from "../../config/limits";
import "./bugReport.css";

type Status =
    | { kind: "idle" }
    | { kind: "sending" }
    | { kind: "sent" }
    | { kind: "error"; message: string };

interface BugReportDialogProps {
    open: boolean;
    onClose: () => void;
    source: BugReportSource;
    errorDigest?: string;
}

// A native modal <dialog>: the browser keeps focus inside it, puts everything
// else behind it (the top layer, above every z-index in the app), closes it
// on Escape and hands focus back to whatever opened it. A centred card from
// sm up; below that, a full-screen sheet sized to the visual viewport, so an
// open keyboard shrinks the sheet instead of covering the Send button.
export default function BugReportDialog({ open, onClose, source, errorDigest }: BugReportDialogProps) {
    const t = useT();
    const dialogRef = useRef<HTMLDialogElement>(null);
    const whatRef = useRef<HTMLTextAreaElement>(null);
    const [whatHappened, setWhatHappened] = useState("");
    const [expected, setExpected] = useState("");
    const [status, setStatus] = useState<Status>({ kind: "idle" });
    const titleId = useId();
    const introId = useId();
    const whatId = useId();
    const expectedId = useId();
    const errorId = useId();

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (open && !dialog.open) {
            dialog.showModal();
            whatRef.current?.focus();
        } else if (!open && dialog.open) {
            dialog.close();
        }
    }, [open]);

    // Every way out (Escape, the backdrop, Close, Cancel, Done) ends in the
    // dialog's close event. A report that went through starts the next one
    // from blank; one closed half-written keeps its text for next time.
    const handleClose = () => {
        if (status.kind === "sent") {
            setWhatHappened("");
            setExpected("");
        }
        setStatus({ kind: "idle" });
        onClose();
    };

    useEffect(() => {
        if (!open) return;
        const dialog = dialogRef.current;
        const viewport = window.visualViewport;
        const root = document.documentElement;
        const previousOverflow = root.style.overflow;
        // The modal already blocks the page; this stops a wheel or swipe
        // from scrolling it underneath the backdrop.
        root.style.overflow = "hidden";
        const sync = () => {
            if (!dialog || !viewport) return;
            dialog.style.setProperty("--bug-report-vv-height", `${viewport.height}px`);
            dialog.style.setProperty("--bug-report-vv-top", `${viewport.offsetTop}px`);
        };
        sync();
        viewport?.addEventListener("resize", sync);
        viewport?.addEventListener("scroll", sync);
        return () => {
            root.style.overflow = previousOverflow;
            viewport?.removeEventListener("resize", sync);
            viewport?.removeEventListener("scroll", sync);
        };
    }, [open]);

    const close = () => dialogRef.current?.close();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (status.kind === "sending") return;
        if (whatHappened.trim().length < BUG_REPORT_MIN_LENGTH) {
            setStatus({ kind: "error", message: t("bugReport.tooShort") });
            whatRef.current?.focus();
            return;
        }
        // The service worker answers a server action with a 503 offline
        // (public/service-worker.js), which would only surface as a vaguer
        // failure below.
        if (!navigator.onLine) {
            setStatus({ kind: "error", message: t("bugReport.offline") });
            return;
        }
        setStatus({ kind: "sending" });
        try {
            const result = await sendBugReport({
                whatHappened,
                expected,
                pageUrl: window.location.href,
                viewport: `${window.innerWidth}x${window.innerHeight}`,
                source,
                errorDigest,
            });
            setStatus(result.ok ? { kind: "sent" } : { kind: "error", message: result.message });
        } catch {
            setStatus({ kind: "error", message: t(navigator.onLine ? "bugReport.failed" : "bugReport.offline") });
        }
    };

    const sending = status.kind === "sending";
    const fieldClassName = "block w-full resize-y rounded-xl border border-gray-300 bg-white px-3.5 py-3 text-base text-gray-900 placeholder:text-gray-500 transition-[box-shadow,border-color] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-400 sm:text-sm";

    return (
        <dialog
            ref={dialogRef}
            aria-labelledby={titleId}
            aria-describedby={introId}
            onClose={handleClose}
            // Escape mid-send would hide the result the person is waiting for.
            onCancel={(e) => { if (sending) e.preventDefault(); }}
            // Only a click on the backdrop lands on the <dialog> itself - the
            // panel inside fills the whole box.
            onClick={(e) => { if (e.target === e.currentTarget && !sending) close(); }}
            // Size and the phone sheet live in bugReport.css.
            className="bug-report-dialog border border-gray-300 bg-white p-0 text-gray-900 shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        >
            <div className="bug-report-panel flex flex-col">
                <div className="flex items-start gap-3 border-b border-gray-200 px-5 pb-4 pt-5 dark:border-gray-700 sm:px-6">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pink-100 text-pink-600 dark:bg-pink-500/20 dark:text-pink-300">
                        <Bug className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                        <h2 id={titleId} className="text-xl font-semibold">
                            {t("bugReport.title")}
                        </h2>
                        <p id={introId} className="mt-1 text-sm text-muted-foreground">
                            {t("bugReport.intro")}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={close}
                        disabled={sending}
                        aria-label={t("bugReport.close")}
                        className="-me-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
                    >
                        <X className="h-5 w-5" aria-hidden="true" />
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                    {status.kind === "sent" ? (
                        <div className="flex flex-col items-center py-4 text-center" role="status">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-success dark:bg-green-500/15">
                                <CheckCircle2 className="h-9 w-9" aria-hidden="true" />
                            </div>
                            <h3 className="mt-4 text-lg font-semibold">{t("bugReport.sentTitle")}</h3>
                            <p className="mt-2 max-w-sm text-muted-foreground">{t("bugReport.sentBody")}</p>
                            <button
                                type="button"
                                onClick={close}
                                autoFocus
                                className="mt-6 min-h-11 rounded-xl bg-primary px-8 font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-800"
                            >
                                {t("bugReport.done")}
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
                            <div>
                                <label htmlFor={whatId} className="mb-1.5 block font-medium">
                                    {t("bugReport.whatHappened")}
                                </label>
                                <textarea
                                    ref={whatRef}
                                    id={whatId}
                                    name="whatHappened"
                                    // The page's direction while empty - an empty
                                    // dir="auto" field can land on LTR and lay a
                                    // Hebrew or Arabic placeholder out backwards.
                                    dir={whatHappened ? "auto" : undefined}
                                    rows={4}
                                    required
                                    maxLength={BUG_REPORT_MAX_LENGTH}
                                    value={whatHappened}
                                    onChange={(e) => setWhatHappened(e.target.value)}
                                    placeholder={t("bugReport.whatHappenedPlaceholder")}
                                    disabled={sending}
                                    aria-invalid={status.kind === "error" && whatHappened.trim().length < BUG_REPORT_MIN_LENGTH ? true : undefined}
                                    aria-describedby={status.kind === "error" ? errorId : undefined}
                                    className={fieldClassName}
                                />
                            </div>
                            <div>
                                <label htmlFor={expectedId} className="mb-1.5 block font-medium">
                                    {t("bugReport.expected")}{" "}
                                    <span className="text-sm font-normal text-muted-foreground">{t("bugReport.optional")}</span>
                                </label>
                                <textarea
                                    id={expectedId}
                                    name="expected"
                                    dir={expected ? "auto" : undefined}
                                    rows={3}
                                    maxLength={BUG_REPORT_MAX_LENGTH}
                                    value={expected}
                                    onChange={(e) => setExpected(e.target.value)}
                                    placeholder={t("bugReport.expectedPlaceholder")}
                                    disabled={sending}
                                    className={fieldClassName}
                                />
                            </div>

                            <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                                <ShieldCheck className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
                                <span>{t("bugReport.privacyNote")}</span>
                            </p>

                            {status.kind === "error" && (
                                <div
                                    id={errorId}
                                    role="alert"
                                    className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 px-3.5 py-3 text-sm font-medium text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200"
                                >
                                    <AlertCircle className="mt-px h-5 w-5 shrink-0" aria-hidden="true" />
                                    <span>{status.message}</span>
                                </div>
                            )}

                            {/* Send first in the DOM order people tab through on a
                                phone, where the two stack; side by side from sm,
                                with Send at the end like the app's other dialogs. */}
                            <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
                                <button
                                    type="submit"
                                    disabled={sending}
                                    className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-gray-800"
                                >
                                    {sending && (
                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
                                    )}
                                    {sending ? t("bugReport.sending") : t("bugReport.send")}
                                </button>
                                <button
                                    type="button"
                                    onClick={close}
                                    disabled={sending}
                                    className="min-h-11 rounded-xl border border-gray-300 px-5 font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                                >
                                    {t("bugReport.cancel")}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </dialog>
    );
}
