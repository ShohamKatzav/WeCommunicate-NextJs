"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, Mail, Linkedin, Facebook, Github } from "lucide-react";
import { useUser } from "../hooks/useUser";
import "./bars.css";

// Chat is a full-viewport shell sized to the gap under the navbar. A tall
// in-flow footer there would either cover the composer or force the page to
// scroll under a non-scrolling message list, so this page omits it. Everywhere
// else the footer sits in document flow at the bottom of the content.
const APP_SHELL_PATHS = ["/chat"];

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

    const currentPath = pathname || '';
    const isAppShell = APP_SHELL_PATHS.some(
        (path) => currentPath === path || currentPath.startsWith(`${path}/`)
    );
    if (isAppShell) return null;

    return (
        <footer className="footer bg-zinc-950 text-zinc-300 pb-[var(--bottom-prompt-height)]">
            <div
                className="h-0.5 bg-linear-to-r from-pink-400 via-indigo-500 to-indigo-700"
                aria-hidden="true"
            />
            <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 md:py-12">
                <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="sm:col-span-2 lg:col-span-1">
                        <Link href="/" className="inline-flex items-center gap-2.5">
                            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-linear-to-br from-pink-400 to-indigo-700 text-white shadow-md shadow-indigo-900/40">
                                <MessageSquare className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <span className="text-lg font-semibold tracking-tight text-white">
                                WeCommunicate
                            </span>
                        </Link>
                        <p className="mt-4 max-w-xs text-sm leading-relaxed text-zinc-400">
                            Real-time chat with voice notes, disappearing messages, and full
                            offline support - free, in your browser.
                        </p>
                    </div>

                    <div>
                        <h2 className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
                            Explore
                        </h2>
                        <ul className="mt-4 space-y-2.5">
                            {productLinks.map((item) => (
                                <li key={item.href}>
                                    <Link
                                        href={item.href}
                                        className="text-sm text-zinc-300 transition-colors hover:text-white"
                                    >
                                        {item.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h2 className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
                            Account
                        </h2>
                        <ul className="mt-4 space-y-2.5">
                            {signedIn ? (
                                <>
                                    <li>
                                        <Link
                                            href="/chat"
                                            className="text-sm text-zinc-300 transition-colors hover:text-white"
                                        >
                                            Open chat
                                        </Link>
                                    </li>
                                    {user?.isModerator && (
                                        <li>
                                            <Link
                                                href="/moderator"
                                                className="text-sm text-zinc-300 transition-colors hover:text-white"
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
                                            className="text-sm text-zinc-300 transition-colors hover:text-white"
                                        >
                                            Log in
                                        </Link>
                                    </li>
                                    <li>
                                        <Link
                                            href="/sign-up"
                                            className="text-sm text-zinc-300 transition-colors hover:text-white"
                                        >
                                            Create an account
                                        </Link>
                                    </li>
                                </>
                            )}
                        </ul>
                    </div>

                    <div>
                        <h2 className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
                            Connect
                        </h2>
                        <div className="mt-4 flex flex-wrap gap-2">
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
                                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-300 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
                                    >
                                        <Icon className="h-4 w-4" aria-hidden="true" />
                                    </a>
                                );
                            })}
                        </div>
                        <p className="mt-4 text-sm text-zinc-400">
                            Questions or feedback?{" "}
                            <Link
                                href="/contact"
                                className="font-medium text-indigo-300 underline-offset-2 hover:text-white hover:underline"
                            >
                                Get in touch
                            </Link>
                        </p>
                    </div>
                </div>

                <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
                    <p>&copy; {year} WeCommunicate. Built by Shoham Katzav.</p>
                    <p>A real-time chat app running on free-tier infrastructure.</p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
