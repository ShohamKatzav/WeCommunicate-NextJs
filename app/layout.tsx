import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ClientProviders from "./context/clientProviders";
import InstallPrompt from "./components/InstallPrompt";
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
    "bg-gradient-to-b from-gray-50 via-white to-gray-100",
    "text-gray-900",
    "dark:from-gray-900 dark:via-gray-900 dark:to-gray-950 dark:text-gray-50",
  ].join(" ");

  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icon.png" />
      </head>
      <body className={bodyClassName}>
        <InstallPrompt />
        <OfflineHandler>
          <ClientProviders>{children}</ClientProviders>
        </OfflineHandler>
      </body>
    </html>
  );
}