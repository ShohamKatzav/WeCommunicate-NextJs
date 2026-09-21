import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ClientProviders from "./context/clientProviders";
import ThemeProvider from "./context/themeProvider";
import { BottomPromptProvider } from "./context/bottomPromptProvider";
import InstallPrompt from "./components/InstallPrompt";
import BottomPromptStack from "./components/bottomPromptStack";
import OfflineHandler from "./components/offlineHandler";
import ServiceWorkerRegistrar from "./components/serviceWorkerRegistrar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  manifest: "/manifest.json",
  title: "WeCommunicate",
  description: "WeCommunicate is a chat app",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "WeCommunicate",
  },
  verification: {
    google: "DznpoaFMof5Nx5Ok_dgC9iQp-rk2lyb7jIv-ZFAb9Kk",
  },
};

export const viewport: Viewport = {
  // A pure-CSS fallback for a visitor who never touches the toggle: the
  // status bar/PWA chrome still follows the OS with zero JS. ThemeColorSync
  // (themeProvider.tsx) layers an explicit override on top of this once
  // someone actually picks light or dark rather than "system".
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f4f6" },
    { media: "(prefers-color-scheme: dark)", color: "#111827" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const bodyClassName = [
    geistSans.variable,
    geistMono.variable,
    "antialiased",
    // next/font defines --font-geist-sans on this element, not on :root, so the
    // theme's font-sans resolves to nothing and the `font-sans` utility falls
    // through to the generic stack. Pointing at the variable directly is what
    // actually renders in Geist rather than merely downloading it.
    "font-[family-name:var(--font-geist-sans)]",
    // A flat surface one step off white, not white and not a gradient: cards
    // are bg-card, so they need the page behind them to differ everywhere,
    // and a gradient on <body> tiles (and visibly seams) on any page whose
    // content is shorter than the viewport. bg-background/text-foreground
    // are the semantic tokens defined in globals.css (light and dark values
    // in one place, see the comment there) rather than a paired bg-gray-100
    // dark:bg-gray-900 utility class.
    "bg-background text-foreground",
  ].join(" ");

  return (
    // suppressHydrationWarning is specifically for next-themes: its blocking
    // script (see themeProvider.tsx) sets the resolved theme's class on this
    // element before React hydrates, so server and client legitimately
    // disagree about this one attribute for one frame. Scoped to <html> only
    // - it does not suppress mismatches anywhere else in the tree.
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icon.png" />
      </head>
      <body className={bodyClassName}>
        <ThemeProvider>
          {/* One provider around both branches: PushNotificationManager (deep
              inside ClientProviders' children, wherever a page mounts it) and
              InstallPrompt (a direct child of BottomPromptStack below) need to
              share the same prompt queue, but they are siblings in the DOM, not
              ancestor/descendant - portaling into BottomPromptStack moves where
              a prompt renders, not where it sits in the component tree that
              context flows through. */}
          <BottomPromptProvider>
            <ServiceWorkerRegistrar />
            <OfflineHandler>
              <ClientProviders>{children}</ClientProviders>
            </OfflineHandler>
            <BottomPromptStack>
              <InstallPrompt />
            </BottomPromptStack>
          </BottomPromptProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}