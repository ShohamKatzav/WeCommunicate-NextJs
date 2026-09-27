"use client";
import { ComponentProps, useRef, useState } from "react";
import BugReportDialog from "./bugReportDialog";
import type { BugReportSource } from "../../lib/bugReportActions";

type BugReportLauncherProps = Omit<ComponentProps<"button">, "type" | "onClick"> & {
    source: BugReportSource;
    errorDigest?: string;
};

// Any button that opens the bug report form - the floating pill, the chat
// navbar's bug button, the error screen's and the contact page's each style
// their own. Focus goes back to the button when the form closes.
export default function BugReportLauncher({ source, errorDigest, children, ...buttonProps }: BugReportLauncherProps) {
    const [open, setOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);

    return (
        <>
            <button
                {...buttonProps}
                ref={buttonRef}
                type="button"
                aria-haspopup="dialog"
                onClick={() => setOpen(true)}
            >
                {children}
            </button>
            <BugReportDialog
                open={open}
                source={source}
                errorDigest={errorDigest}
                onClose={() => {
                    setOpen(false);
                    buttonRef.current?.focus();
                }}
            />
        </>
    );
}
