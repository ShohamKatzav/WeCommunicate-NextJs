"use client";
import { Fragment, useLayoutEffect, useRef, useState } from "react";

interface FitNameProps {
    // The name exactly as it should read - never rewritten here.
    text: string;
    // Shown on hover once the name had to be cut short (the last resort).
    fullText?: string;
    className?: string;
    // A stable hook for tests - the markup inside changes with the fit.
    testId?: string;
}

// Characters a long name can break after without splitting a word: the
// natural seams of handles and addresses. Spaces break on their own.
const SEAM = /(?<=[@._\-+/])/;

// The smallest size a name is shrunk to before it's cut short instead.
const MIN_FONT_PX = 12;
const MAX_LINES = 3;
// Unitless, so the line box scales with the font while it shrinks.
const LINE_HEIGHT = 1.25;

type Fit = { fontPx: number | null; truncated: boolean };

// A name in a narrow list column (the chat sidebars), fitted in this order:
// 1. At full size, wrapped onto at most three balanced lines, breaking only
//    at spaces or after @ . _ - + / - never mid-word, and never leaving a
//    short leftover like "com" alone on the last line.
// 2. If that doesn't fit (no seams, or still too long), shrunk step by step
//    down to MIN_FONT_PX.
// 3. Only if even that doesn't fit: one line, cut with "…", with a dotted
//    underline and help cursor saying the full name is on hover.
// Measured on a hidden copy that has the break points in it, so what's on
// screen (a cut name has none - they'd still break under nowrap) never
// skews the result. Refitted whenever the column's width changes.
const FitName = ({ text, fullText, className = "", testId }: FitNameProps) => {
    const ref = useRef<HTMLDivElement | null>(null);
    const [fit, setFit] = useState<Fit>({ fontPx: null, truncated: false });

    useLayoutEffect(() => {
        const el = ref.current;
        const parent = el?.parentElement;
        if (!el || !parent) return;
        const parts = text.split(SEAM);

        // Only the column's width decides the fit. The height changes with
        // every fit, so reacting to it too would loop.
        let measuredWidth = -1;
        const measure = () => {
            const width = el.clientWidth;
            if (width === 0 || width === measuredWidth) return;
            measuredWidth = width;

            const probe = document.createElement("div");
            probe.className = className;
            probe.dir = "auto";
            probe.setAttribute("aria-hidden", "true");
            Object.assign(probe.style, {
                position: "absolute",
                visibility: "hidden",
                pointerEvents: "none",
                top: "0",
                insetInlineStart: "0",
                width: `${width}px`,
                whiteSpace: "normal",
                lineHeight: String(LINE_HEIGHT),
                textWrap: "balance",
                overflowWrap: "normal",
                wordBreak: "normal",
            });
            parts.forEach((part, index) => {
                probe.append(part);
                if (index < parts.length - 1) probe.append(document.createElement("wbr"));
            });
            parent.append(probe);

            const basePx = parseFloat(getComputedStyle(probe).fontSize);
            const fits = (px: number) => {
                probe.style.fontSize = `${px}px`;
                const lines = Math.round(probe.scrollHeight / (px * LINE_HEIGHT));
                return probe.scrollWidth <= width + 0.5 && lines <= MAX_LINES;
            };
            let result: Fit = { fontPx: null, truncated: true };
            for (let px = basePx; px >= MIN_FONT_PX; px -= 1) {
                if (fits(px)) {
                    result = { fontPx: px === basePx ? null : px, truncated: false };
                    break;
                }
            }
            probe.remove();
            setFit(prev => prev.fontPx === result.fontPx && prev.truncated === result.truncated ? prev : result);
        };

        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, [text, className]);

    const parts = text.split(SEAM);

    return (
        <div
            ref={ref}
            // dir="auto": the name runs in its own direction, so a Latin name
            // in a Hebrew row still reads - and is cut - from its start.
            // text-left rtl:text-right then keeps it on the page's start edge
            // (physical on purpose: text-start would follow the name's own
            // direction, not the page's).
            dir="auto"
            data-testid={testId}
            title={fit.truncated ? (fullText || text) : undefined}
            style={fit.truncated ? { lineHeight: LINE_HEIGHT } : {
                fontSize: fit.fontPx ? `${fit.fontPx}px` : undefined,
                lineHeight: LINE_HEIGHT,
                textWrap: "balance",
                overflowWrap: "normal",
                wordBreak: "normal",
            }}
            className={`text-left rtl:text-right ${fit.truncated ? "truncate cursor-help underline decoration-dotted decoration-muted-foreground underline-offset-4" : ""} ${className}`}
        >
            {fit.truncated ? text : parts.map((part, index) => (
                <Fragment key={index}>
                    {part}
                    {index < parts.length - 1 && <wbr />}
                </Fragment>
            ))}
        </div>
    );
};

export default FitName;
