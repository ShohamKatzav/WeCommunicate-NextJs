"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, Check } from "lucide-react";

const OPTIONS = [
    { value: "light", label: "Light", Icon: Sun },
    { value: "dark", label: "Dark", Icon: Moon },
    { value: "system", label: "System", Icon: Monitor },
] as const;

interface ThemeToggleProps {
    /** Icon-only trigger for the tight desktop nav row vs. a labelled one for
     * the full-width mobile menu, where there is room and nothing else to
     * disambiguate a bare icon against. */
    variant?: "icon" | "labelled";
    className?: string;
}

// Reachable everywhere the navbar is - including logged out, on /login,
// /sign-up, /forgot-password and the marketing pages - since the preference
// is per-device (localStorage via next-themes), not tied to an account.
export default function ThemeToggle({ variant = "icon", className = "" }: ThemeToggleProps) {
    const { theme, setTheme } = useTheme();
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    // theme is undefined until next-themes reads localStorage on mount; avoid
    // rendering a guess (e.g. always "system") that flips right after hydration.
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        if (!open) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [open]);

    const current = OPTIONS.find(o => o.value === theme) ?? OPTIONS[2];
    const CurrentIcon = current.Icon;

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
                type="button"
                onClick={() => setOpen(prev => !prev)}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={`Theme: ${current.label}. Change theme`}
                className={
                    variant === "icon"
                        ? "flex h-9 w-9 items-center justify-center rounded-md text-zinc-400 hover:bg-white/5 hover:text-white transition-colors"
                        // Same type size/weight and hover behaviour as the plain-text
                        // nav links this sits under in the mobile overlay (see
                        // navbar.tsx), rather than its own smaller, boxed control -
                        // that mismatch in size and having its own chip background
                        // is what made it read as a different kind of row.
                        : "flex items-center justify-center gap-3 text-3xl capitalize text-zinc-300 hover:text-white transition-colors"
                }
            >
                {mounted ? <CurrentIcon className={variant === "icon" ? "h-5 w-5" : "h-7 w-7"} aria-hidden="true" /> : <span className={variant === "icon" ? "h-5 w-5" : "h-7 w-7"} />}
                {variant === "labelled" && <span>{mounted ? current.label : "Theme"}</span>}
            </button>

            {open && (
                <div
                    role="menu"
                    aria-label="Theme"
                    className={
                        variant === "icon"
                            ? "absolute right-0 top-full mt-2 w-40 overflow-hidden rounded-md border border-white/10 bg-zinc-900 py-1 shadow-lg z-50"
                            // In-flow (not absolutely positioned) and no wider than the
                            // trigger above it: the trigger's own row is already fully
                            // on-screen (it's centered in the overlay like its
                            // siblings), so anchoring the menu to exactly that width
                            // keeps it on-screen too instead of guessing a fixed
                            // width that could run off a narrow phone. Being in-flow
                            // also means it becomes part of the overlay's own
                            // scrollable content instead of needing its own
                            // viewport-clipping logic.
                            : "mt-1 w-full overflow-hidden rounded-md border border-white/10 bg-white/5 py-1"
                    }
                >
                    {OPTIONS.map(({ value, label, Icon }) => (
                        <button
                            key={value}
                            type="button"
                            role="menuitemradio"
                            aria-checked={theme === value}
                            onClick={() => {
                                setTheme(value);
                                setOpen(false);
                            }}
                            className="flex w-full items-center gap-3 px-3 py-2 text-sm text-zinc-300 hover:bg-white/10 hover:text-white transition-colors"
                        >
                            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span className="flex-1 text-left">{label}</span>
                            {theme === value && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
