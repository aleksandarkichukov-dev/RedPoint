import type { Metadata } from "next";
import { Inter, Oswald } from "next/font/google";
import { WishlistProvider } from "@/components/wishlist/wishlist-provider";
import { SITE_URL } from "@/lib/site";
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
  /* Every relative URL in metadata resolves against this — the images Facebook
     and Viber fetch when a product is shared, and the canonical tags. Without
     it Next emits paths, and a path is not something another server can
     fetch: the preview arrives with no picture. */
  metadataBase: new URL(SITE_URL),
  /* The home title was just "Red Point", which nobody searches for. What
     people type is the thing plus the place. */
  title: {
    default: "Red Point · Мъжка мода във Варна",
    template: "%s · Red Point",
  },
  description:
    "Мъжка спортно-елегантна мода — якета, дънки, ризи, тениски. Три магазина във Варна и доставка в цялата страна.",
  openGraph: {
    type: "website",
    locale: "bg_BG",
    siteName: "Red Point",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="bg" className={`${oswald.variable} ${inter.variable}`}>
      {/* Above the shop layout so the header's count and the hearts on the
          home page read the same list as the catalogue pages. */}
      <body>
        <WishlistProvider>{children}</WishlistProvider>
      </body>
    </html>
  );
}
