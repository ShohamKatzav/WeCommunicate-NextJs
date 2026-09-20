"use client";

import { useCallback, useEffect, useState } from "react";

// One dismissal policy shared by every bottom prompt, instead of each one
// inventing its own (InstallPrompt used to keep "dismissed" in memory only,
// so it came back on every reload; the push soft-ask persisted permanent
// dismissal but not "Later"). "Dismiss" means "don't show again on this
// device"; "Later" means "stop showing for now, but ask again" - both are
// per-device (localStorage), not tied to the account, so logging out never
// changes what's suppressed.
const dismissedKey = (id: string) => `bp:dismissed:${id}`;
const snoozedUntilKey = (id: string) => `bp:snoozedUntil:${id}`;

const isSuppressed = (id: string): boolean => {
    try {
        if (localStorage.getItem(dismissedKey(id)) === "true") return true;
        const snoozedUntil = Number(localStorage.getItem(snoozedUntilKey(id)));
        return Number.isFinite(snoozedUntil) && Date.now() < snoozedUntil;
    } catch {
        // Private browsing / blocked storage: fail open rather than either
        // permanently hide a prompt or throw and break the caller.
        return false;
    }
};

export function usePromptDismissal(id: string, snoozeHours = 24) {
    // null = not yet read from localStorage. Reading it during render would
    // run on the server too, where there is no localStorage, so this starts
    // undetermined and resolves in an effect - the same "unknown until an
    // effect says otherwise" pattern pushNotificationManager already uses for
    // isSupported, which avoids flashing a prompt that's actually dismissed.
    const [suppressed, setSuppressed] = useState<boolean | null>(null);

    useEffect(() => {
        setSuppressed(isSuppressed(id));
    }, [id]);

    const dismiss = useCallback(() => {
        try {
            localStorage.setItem(dismissedKey(id), "true");
            localStorage.removeItem(snoozedUntilKey(id));
        } catch {
            // Ignore - the prompt still hides for this render via state below.
        }
        setSuppressed(true);
    }, [id]);

    const snooze = useCallback(() => {
        try {
            localStorage.setItem(snoozedUntilKey(id), String(Date.now() + snoozeHours * 60 * 60 * 1000));
        } catch {
            // Ignore - same fallback as dismiss().
        }
        setSuppressed(true);
    }, [id, snoozeHours]);

    return { suppressed, dismiss, snooze };
}
