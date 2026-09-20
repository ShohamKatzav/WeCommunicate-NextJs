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
        // pointer-events-none so the empty width beside a narrow prompt does not
        // swallow clicks meant for the page underneath; each prompt turns them
        // back on for itself.
        <div
            id={BOTTOM_PROMPT_STACK_ID}
            ref={stackRef}
            className="fixed inset-x-0 bottom-[var(--footer-height)] z-[17] flex flex-col items-center gap-2 px-2 pb-2 pointer-events-none sm:px-4"
        >
            {children}
        </div>
    );
}
