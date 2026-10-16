export const dynamic = 'force-dynamic';

import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL("https://mailtion.com"),
  title: "Mailtion - Modern, Fast & Secure Email Platform",
  description: "Experience seamless email communication with Mailtion. Send, receive, and manage your emails effortlessly with modern security and privacy.",
  openGraph: {
    title: "Mailtion - Modern, Fast & Secure Email Platform",
    description: "Experience seamless email communication with Mailtion. Send, receive, and manage your emails effortlessly with modern security and privacy.",
    url: "https://mailtion.com",
    siteName: "Mailtion",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Mailtion - Modern Email Platform",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mailtion - Modern, Fast & Secure Email Platform",
    description: "Experience seamless email communication with Mailtion. Send, receive, and manage your emails effortlessly with modern security and privacy.",
    images: ["/og-image.jpg"],
  },
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.png", sizes: "32x32", type: "image/png" },
    ],
    shortcut: "/favicon.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${plusJakartaSans.variable} font-sans h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">{children}</body>
    </html>
  );
}
