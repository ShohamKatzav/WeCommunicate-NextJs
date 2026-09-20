"use client"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { ReactNode, useEffect } from "react";

// Thin wrapper so every consumer (layout.tsx, the theme toggle) agrees on
// the same config without repeating it: class strategy to match
// @custom-variant dark in globals.css, "system" as the default so a first
// visit follows the OS, and enableColorScheme (the default) sets the
// color-scheme CSS property to match - that's what keeps native form
// controls, scrollbars and autofill in the right theme without any extra
// code here.
export default function ThemeProvider({ children }: { children: ReactNode }) {
    return (
        <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
            <ThemeColorSync />
            {children}
        </NextThemesProvider>
    );
}

// layout.tsx's <meta name="theme-color"> (from Viewport.themeColor) is a
// static pair of prefers-color-scheme media queries, which is enough for
// someone who never touches the toggle - but it can't see an explicit
// light/dark override that disagrees with the OS. This adds a third,
// unconditional meta tag on top of those two once the visitor picks
// something other than "system", so the mobile status bar/PWA chrome
// follows the choice actually in effect (resolvedTheme) rather than only
// what the OS reports.
function ThemeColorSync() {
    const { theme, resolvedTheme } = useTheme();

    useEffect(() => {
        const id = "theme-color-override";
        let meta = document.getElementById(id) as HTMLMetaElement | null;

        if (theme === "system") {
            meta?.remove();
            return;
        }

        if (!meta) {
            meta = document.createElement("meta");
            meta.id = id;
            meta.name = "theme-color";
            document.head.appendChild(meta);
        }
        meta.content = resolvedTheme === "dark" ? "#111827" : "#f3f4f6";
    }, [theme, resolvedTheme]);

    return null;
}
