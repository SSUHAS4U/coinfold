import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Coinfold — pay the bill, keep the change",
  description:
    "Pay credit-card bills, earn a coin for every ₹100, and see exactly where the money went.",
};

export const viewport: Viewport = {
  // Matches --bg so the mobile browser chrome does not sit as a light band
  // above a near-black page.
  themeColor: "#08090a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <head>
        {/*
          Applies the saved theme before first paint. Without this the page
          renders dark, then flips to light on hydration — a visible flash on
          every load for anyone who chose light.

          Dark is the default: only an explicit "light" preference switches.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('coinfold.theme')==='light'){document.documentElement.classList.add('light')}}catch(e){}`,
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
