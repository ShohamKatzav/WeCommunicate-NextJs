"use client";
import { ReactNode, useLayoutEffect, useRef, useState } from "react";

// The smallest a page title shrinks to before a word is allowed to spill.
const MIN_FONT_PX = 20;

interface PageTitleProps {
    className?: string;
    children: ReactNode;
}

// A page title (see pageTitle.ts for its size) that never runs off a phone
// screen. Titles wrap between words, but one long word - Russian
// "конфиденциальности" on /privacy - can still be wider than the screen at
// the title size. When a word doesn't fit, the whole title shrinks just
// enough for it to; otherwise this changes nothing. Refitted when the
// title's width changes.
const PageTitle = ({ className = "", children }: PageTitleProps) => {
    const ref = useRef<HTMLHeadingElement | null>(null);
    const [fontPx, setFontPx] = useState<number | null>(null);

    useLayoutEffect(() => {
        const h = ref.current;
        if (!h) return;
        let fittedWidth = -1;
        const fit = () => {
            const width = h.clientWidth;
            if (width === 0 || width === fittedWidth) return;
            fittedWidth = width;
            h.style.fontSize = "";
            let size = parseFloat(getComputedStyle(h).fontSize);
            const natural = size;
            while (h.scrollWidth > h.clientWidth + 1 && size > MIN_FONT_PX) {
                size -= 1;
                h.style.fontSize = `${size}px`;
            }
            const result = size === natural ? null : size;
            h.style.fontSize = result ? `${result}px` : "";
            setFontPx(prev => prev === result ? prev : result);
        };
        fit();
        const observer = new ResizeObserver(fit);
        observer.observe(h);
        return () => observer.disconnect();
    }, [children]);

    return (
        <h1 ref={ref} className={className} style={fontPx ? { fontSize: fontPx } : undefined}>
            {children}
        </h1>
    );
};

export default PageTitle;
