import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { bootScript } from "@/lib/boot";
import { BRAND } from "@/lib/brand";
import { Providers } from "@/components/Providers";
import { AdminShortcut } from "@/components/admin/AdminShortcut";
import "./globals.css";

// Self-hosted so the build never needs the network (fonts are OFL; licences sit next to the files).
const geistSans = localFont({
  src: "./fonts/Geist-Variable.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});
const geistMono = localFont({
  src: "./fonts/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});
const newsreader = localFont({
  src: "./fonts/Newsreader-Variable-latin.woff2",
  variable: "--font-newsreader",
  weight: "200 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: BRAND.description,
  icons: { icon: "/icon.svg", apple: "/apple-icon.png" },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f7f4" },
    { media: "(prefers-color-scheme: dark)", color: "#171315" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme / data-sidebar / data-motion are set by the boot script before
    // paint, never by React, so the server HTML and the first frame agree.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable}`}
    >
      <head>
        {/* The only inline script: a constant (see src/lib/boot.ts). */}
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className="min-h-dvh">
        <Providers>
          {children}
          <AdminShortcut />
        </Providers>
      </body>
    </html>
  );
}
