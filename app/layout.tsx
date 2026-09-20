import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ClientProviders from "./context/clientProviders";
import { BottomPromptProvider } from "./context/bottomPromptProvider";
import InstallPrompt from "./components/InstallPrompt";
import BottomPromptStack from "./components/bottomPromptStack";
import OfflineHandler from "./components/offlineHandler";
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
  themeColor: "#fff",
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
    // are bg-white, so they need the page behind them to differ everywhere,
    // and a gradient on <body> tiles (and visibly seams) on any page whose
    // content is shorter than the viewport.
    "bg-gray-100 text-gray-900",
    "dark:bg-gray-900 dark:text-gray-50",
  ].join(" ");

  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icon.png" />
      </head>
      <body className={bodyClassName}>
        {/* One provider around both branches: PushNotificationManager (deep
            inside ClientProviders' children, wherever a page mounts it) and
            InstallPrompt (a direct child of BottomPromptStack below) need to
            share the same prompt queue, but they are siblings in the DOM, not
            ancestor/descendant - portaling into BottomPromptStack moves where
            a prompt renders, not where it sits in the component tree that
            context flows through. */}
        <BottomPromptProvider>
          <OfflineHandler>
            <ClientProviders>{children}</ClientProviders>
          </OfflineHandler>
          <BottomPromptStack>
            <InstallPrompt />
          </BottomPromptStack>
        </BottomPromptProvider>
      </body>
    </html>
  );
}