"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Mail, Linkedin, Facebook, Github } from "lucide-react";
import { useUser } from "../hooks/useUser";
import "./bars.css";

// Chat is a full-viewport shell sized to the gap under the navbar
// (.viewport-between-bars, app/globals.css), which subtracts --footer-height
// from 100dvh so this in-flow footer still ends up on screen instead of
// below the fold. Every other page leaves --footer-height at its 0px
// default: BottomPromptStack (bottomPromptStack.tsx) reads the same
// variable to sit its fixed prompt bar right above the footer, and outside
// chat that bar is meant to overlay the footer's tail end, not make room
// for it (see the footer-jump comment below).
// On a phone, and in landscape where the screen is shorter than this
// footer, that subtraction eats the chat. bars.css hides .is-app-shell
// for the same media query, and the effect below publishes 0 so the shell
// fills the screen. The navbar menu still reaches these links.
const APP_SHELL_PATHS = ["/chat"];

const COMPACT_SHELL_QUERY = "(max-width: 768px), (max-height: 500px) and (max-width: 1024px)";

const productLinks = [
    { href: "/chat", label: "Chat" },
    { href: "/locations", label: "Locations" },
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
];

const socialLinks = [
    {
        href: "mailto:shohamkatzav95@gmail.com",
        label: "Email",
        icon: Mail,
    },
    {
        href: "https://github.com/ShohamKatzav/",
        label: "GitHub",
        icon: Github,
        external: true,
    },
    {
        href: "https://www.linkedin.com/in/shoham-katzav/",
        label: "LinkedIn",
        icon: Linkedin,
        external: true,
    },
    {
        href: "https://www.facebook.com/shoham.katzav/",
        label: "Facebook",
        icon: Facebook,
        external: true,
    },
];

const Footer = () => {
    const pathname = usePathname();
    const { user } = useUser();
    const year = new Date().getFullYear();
    const signedIn = Boolean(user && Object.keys(user).length > 0);
    const footerRef = useRef<HTMLElement>(null);

    const currentPath = pathname || '';
    const isAppShell = APP_SHELL_PATHS.some(
        (path) => currentPath === path || currentPath.startsWith(`${path}/`)
    );

    useEffect(() => {
        // Only chat's own height calc needs the real number (see the import
        // comment above) - everywhere else must keep the 0px default, so
        // leaving chat has to clear this rather than leave the last
        // measured height stuck on the CSS variable.
        if (!isAppShell) {
            document.documentElement.style.removeProperty("--footer-height");
            return;
        }

        const footer = footerRef.current;
        if (!footer) return;

        const compactShellQuery = window.matchMedia(COMPACT_SHELL_QUERY);

        const publishHeight = () => {
            // A hidden footer (bars.css, same query) reports 0 anyway; the
            // explicit branch covers the resize from a wide window, where
            // the last measured height would otherwise stay applied for a
            // frame and keep crushing the chat.
            const height = compactShellQuery.matches ? 0 : footer.offsetHeight;
            document.documentElement.style.setProperty("--footer-height", `${height}px`);
        };

        publishHeight();
        const resizeObserver = new ResizeObserver(publishHeight);
        resizeObserver.observe(footer);
        compactShellQuery.addEventListener("change", publishHeight);

        return () => {
            resizeObserver.disconnect();
            compactShellQuery.removeEventListener("change", publishHeight);
            document.documentElement.style.removeProperty("--footer-height");
        };
    }, [isAppShell]);

    return (
        // No pb-[var(--bottom-prompt-height)] here: padding the footer's own
        // box grows it, and on a short page that eats the leftover space
        // margin-top: auto (bars.css) was using to park it at the viewport
        // bottom - the footer visibly jumped up whenever a prompt appeared.
        // BottomPromptStack is fixed + a higher z-index than this static
        // footer, so it already overlays the footer's tail end on its own;
        // nothing needs to make room for it here. (On /chat there is no
        // "short page" case - the shell above is sized to leave exactly
        // this footer's height, so the prompt bar lands in the gap between
        // the composer and the footer instead of over either one.)
        // bg-bar-background (see navbar.tsx/globals.css): its own solid
        // token, not --background (same as the page) and not --card
        // (lighter than the page in dark mode, not darker). shadow-[0_-...]
        // is shadow-md's shape flipped upward, since the footer needs to
        // look lifted off the page above it rather than below it.
        <footer ref={footerRef} className={`footer bg-bar-background shadow-[0_-4px_8px_rgba(0,0,0,0.15)]${isAppShell ? " is-app-shell" : ""}`}>
            <div
                className="h-[3px] bg-linear-to-r from-pink-400 via-indigo-500 to-indigo-700"
                aria-hidden="true"
            />
            <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8 md:py-12">
                <div className="grid gap-6 sm:grid-cols-2 sm:gap-10 lg:grid-cols-4">
                    <div className="sm:col-span-2 lg:col-span-1">
                        <Link href="/" className="inline-flex items-center gap-2.5">
                            {/* Decorative - the wordmark right next to it already names the app. */}
                            <Image
                                src="/icon192.png"
                                alt=""
                                width={36}
                                height={36}
                                className="h-9 w-9 shrink-0 rounded-lg"
                            />
                            <span className="text-lg font-semibold tracking-tight text-foreground">
                                WeCommunicate
                            </span>
                        </Link>
                        <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground sm:mt-4">
                            Real-time chat with voice notes, disappearing messages, and full
                            offline support - free, in your browser.
                        </p>
                    </div>

                    {/* Grouped into one grid row on phones instead of each
                        stacking full-width - the biggest single contributor to
                        the footer outgrowing short pages. sm:contents drops
                        this wrapper from layout at the sm breakpoint so Explore
                        and Account rejoin the outer grid as their own columns,
                        unchanged from the desktop layout below. */}
                    <div className="grid grid-cols-2 gap-6 sm:contents">
                        <div>
                            <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                                Explore
                            </h2>
                            <ul className="mt-3 space-y-2 sm:mt-4 sm:space-y-2.5">
                                {productLinks.map((item) => (
                                    <li key={item.href}>
                                        <Link
                                            href={item.href}
                                            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                                        >
                                            {item.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div>
                            <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                                Account
                            </h2>
                            <ul className="mt-3 space-y-2 sm:mt-4 sm:space-y-2.5">
                                {signedIn ? (
                                    <>
                                        <li>
                                            <Link
                                                href="/chat"
                                                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                                            >
                                                Open chat
                                            </Link>
                                        </li>
                                        {user?.isModerator && (
                                            <li>
                                                <Link
                                                    href="/moderator"
                                                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                                                >
                                                    Moderator
                                                </Link>
                                            </li>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <li>
                                            <Link
                                                href="/login"
                                                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                                            >
                                                Log in
                                            </Link>
                                        </li>
                                        <li>
                                            <Link
                                                href="/sign-up"
                                                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                                            >
                                                Create an account
                                            </Link>
                                        </li>
                                    </>
                                )}
                            </ul>
                        </div>
                    </div>

                    <div>
                        <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                            Connect
                        </h2>
                        {/* flex-nowrap: only 4 icons, so they always fit one
                            row even at the narrowest supported width - wrapping
                            would just add an unnecessary second row. */}
                        <div className="mt-3 flex flex-nowrap gap-2 sm:mt-4">
                            {socialLinks.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <a
                                        key={item.href}
                                        href={item.href}
                                        {...(item.external
                                            ? { target: "_blank", rel: "noopener noreferrer" }
                                            : {})}
                                        aria-label={item.label}
                                        title={item.label}
                                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border/40 bg-foreground/5 text-muted-foreground transition-colors hover:border-border hover:bg-foreground/10 hover:text-foreground"
                                    >
                                        <Icon className="h-4 w-4" aria-hidden="true" />
                                    </a>
                                );
                            })}
                        </div>
                        <p className="mt-3 text-sm text-muted-foreground sm:mt-4">
                            Questions or feedback?{" "}
                            <Link
                                href="/contact"
                                className="font-medium text-primary underline-offset-2 hover:underline"
                            >
                                Get in touch
                            </Link>
                        </p>
                    </div>
                </div>

                <div className="mt-6 flex flex-col gap-2 border-t border-border/40 pt-4 text-xs text-muted-foreground sm:mt-10 sm:flex-row sm:items-center sm:justify-between sm:pt-6">
                    <p>&copy; {year} WeCommunicate. Built by Shoham Katzav.</p>
                    <p>A real-time chat app running on free-tier infrastructure.</p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
