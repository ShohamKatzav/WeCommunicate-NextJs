import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ClientProviders from "./context/clientProviders";
import ServiceWorkerRegister from "./components/ServiceWorkerRegister";
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
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "WeCommunicate",
  },
};

export const viewport: Viewport = {
  themeColor: "#fff",
};

export default function RootLayout({
  children,
}: { children: React.ReactNode; }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icon.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ServiceWorkerRegister />
        <InstallPrompt />
        <OfflineHandler>
          <ClientProviders>
            {children}
          </ClientProviders>
        </OfflineHandler>
      </body>
    </html>
  );
}