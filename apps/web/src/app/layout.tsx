import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Inter } from "next/font/google";

import "./globals.css";

/**
 * Inter, with the OpenType features that make financial figures behave:
 * tabular numerals for alignment, cv01/cv03 for a single-storey `a` and an
 * open `g`, which is what gives it the SF-adjacent feel the design calls for.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
});

/**
 * The display face. The design skill's rule is explicit — never Inter or
 * Roboto as display — because a system sans set large is the single clearest
 * tell of a generated page. Instrument Serif is high-contrast and editorial,
 * and it gives the hero a voice the body copy does not have.
 */
const display = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Coinfold — see your money move",
  description:
    "Pay credit-card bills, earn a coin for every ₹100, and watch 10,000 transactions turn into something you can actually read.",
};

export const viewport: Viewport = {
  // Two entries so the mobile browser chrome matches the canvas in each theme
  // rather than sitting as a mismatched band above the page.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0f" },
  ],
  width: "device-width",
  initialScale: 1,
  // The scroll story pins a stage; letting it zoom out mid-pin breaks the
  // geometry. Users can still zoom in, which is what accessibility requires.
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <head>
        {/*
          Applies the saved theme before first paint. Light is the default now,
          so only an explicit "dark" preference — or the OS asking for dark when
          the user has expressed no preference — adds the class. Without this
          the page paints light then flips, which is a visible flash on every
          load for anyone using dark.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('coinfold.theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}`,
          }}
        />
      </head>
      <body className={`${inter.variable} ${display.variable} antialiased`}>{children}</body>
    </html>
  );
}
