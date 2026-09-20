"use client";

import { useEffect, useRef } from "react";

// The install and notification prompts used to be fixed to the bottom of the
// viewport on their own, which meant they floated over whatever was already
// there - on /chat that is the message composer, and that page has no scroll of
// its own to bring the covered part back. They now share this stack, which
// publishes its own height as --bottom-prompt-height so full-viewport views can
// give up exactly that much room (see .viewport-between-bars in globals.css) and
// page content can add it to its bottom spacing. Nothing important ends up
// underneath a prompt, on a phone or on a desktop window.
//
// The stack itself only ever holds one visible prompt at a time: each prompt
// component calls usePromptSlot to join a shared queue (BottomPromptProvider,
// mounted around this in layout.tsx) and only renders its own markup when it
// is at the front of it. That is what keeps --bottom-prompt-height bounded to
// a single slim bar's height no matter how many prompts want attention -
// stacking full cards the way this used to is exactly the "costs a real
// fraction of the screen" problem this stack exists to avoid.

export const BOTTOM_PROMPT_STACK_ID = "bottom-prompt-stack";

export default function BottomPromptStack({ children }: { children?: React.ReactNode }) {
    const stackRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const stack = stackRef.current;
        if (!stack) return;

        const publishHeight = () => {
            // An empty stack has to publish 0 rather than its own padding:
            // every page adds this value to the space it reserves at the bottom.
            const height = stack.childElementCount === 0 ? 0 : stack.offsetHeight;
            document.documentElement.style.setProperty("--bottom-prompt-height", `${height}px`);
        };

        publishHeight();

        // Size changes cover a prompt growing on a narrow screen; child changes
        // cover prompts mounting and unmounting, including the ones portalled in
        // here from elsewhere in the tree.
        const resizeObserver = new ResizeObserver(publishHeight);
        resizeObserver.observe(stack);
        const mutationObserver = new MutationObserver(publishHeight);
        mutationObserver.observe(stack, { childList: true, subtree: true });

        return () => {
            resizeObserver.disconnect();
            mutationObserver.disconnect();
            document.documentElement.style.removeProperty("--bottom-prompt-height");
        };
    }, []);

    return (
        // pointer-events-none so the empty height while nothing is queued does
        // not swallow clicks meant for the page underneath; the single visible
        // prompt (PromptBar) turns them back on for itself. aria-live rather
        // than role="alert": a prompt appearing is worth announcing, but none
        // of these are urgent enough to interrupt whatever the screen reader
        // is already saying.
        // pb-[env(safe-area-inset-bottom)] keeps the bar above the home
        // indicator/gesture bar in an installed PWA (standalone display mode)
        // without changing anything in the browser, where that env() is 0.
        <div
            id={BOTTOM_PROMPT_STACK_ID}
            ref={stackRef}
            role="region"
            aria-label="Notifications"
            aria-live="polite"
            className="fixed inset-x-0 bottom-[var(--footer-height)] z-[17] pb-[env(safe-area-inset-bottom)] pointer-events-none"
        >
            {children}
        </div>
    );
}
