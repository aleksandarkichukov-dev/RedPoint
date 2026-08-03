import type { Metadata } from "next";
import { Inter, Oswald } from "next/font/google";
import "./globals.css";

/* Oswald stands in for DIN Pro, Inter for Gotham HCo.

   Barlow Condensed was the original pick in the handoff spec, but it ships no
   Cyrillic subset, so every Bulgarian headline would silently fall back to
   Arial Narrow and lose the identity in the primary market. Oswald is the
   closest free condensed display face with full Cyrillic coverage.

   Both licensed originals can be swapped in later by editing the token stacks
   in @redpoint/design-system, without touching a single component. */
const oswald = Oswald({
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
  weight: ["500", "600", "700"],
  variable: "--font-oswald",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Red Point",
  description: "Мъжка спортно-елегантна мода. Три магазина във Варна.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="bg" className={`${oswald.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
