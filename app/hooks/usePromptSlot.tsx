"use client";
import { useContext, useEffect } from "react";
import BottomPromptContext from "../context/bottomPromptContext";

// Registers this prompt's desire to be shown with the shared queue in
// BottomPromptProvider, and reports back whether it is the one prompt
// BottomPromptStack is currently allowed to render. `wantsToShow` should
// already fold in every other reason the prompt has to be hidden (dismissed,
// snoozed, not applicable) - this hook only ever adds "someone else is ahead
// of you in line" on top of that.
export const usePromptSlot = (id: string, wantsToShow: boolean) => {
    const context = useContext(BottomPromptContext);
    if (context === undefined) {
        throw new Error('usePromptSlot must be used within a BottomPromptProvider');
    }
    const { activeIds, register, unregister } = context;

    useEffect(() => {
        if (wantsToShow) {
            register(id);
            return () => unregister(id);
        }
        unregister(id);
    }, [id, wantsToShow, register, unregister]);

    // Everyone else currently registered, regardless of where in line this
    // prompt itself sits - only meaningful when isCurrent is true, since that
    // is the only time a caller renders the "+N more" chip.
    const queuedBehind = Math.max(0, activeIds.length - (activeIds.includes(id) ? 1 : 0));

    return {
        isCurrent: wantsToShow && activeIds[0] === id,
        queuedBehind,
    };
};
