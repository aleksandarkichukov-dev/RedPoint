import { ChatPanel } from "@/components/chat/chat-panel";
import { CategoryCarousel } from "@/components/home/category-carousel";
import { Hero } from "@/components/home/hero";
import { Manifesto } from "@/components/home/manifesto";
import { ProductGrid } from "@/components/home/product-grid";
import { Stores } from "@/components/home/stores";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import {
  getRegionId,
  listProducts,
  resolveCategoryTiles,
  type StoreProduct,
} from "@/lib/catalog";
import {
  FEATURED_CATEGORIES,
  MANIFESTO,
  STORES,
  type CategoryTile,
} from "@/lib/home";

/**
 * Home page.
 *
 * The Phase 3 brief specified nine sections; the campaign band and the sale
 * rail are gone because the client dropped the sale category, and with it the
 * `SaleRail` and `CampaignBand` components — both are in git history if a sale
 * section ever comes back.
 *
 * The product sections read the real catalogue. If the backend is down the page
 * still renders: the editorial sections stand on their own and the product ones
 * drop out, which is a far better failure than a 500 on the front page.
 */
async function loadProducts(): Promise<{
  newArrivals: StoreProduct[];
  categoryTiles: CategoryTile[];
}> {
  try {
    const regionId = await getRegionId();
    const categoryTiles = await resolveCategoryTiles(FEATURED_CATEGORIES, regionId);

    /* Ordered by article number, not created_at. Every product was created
       within seconds of the other during the seed, so created_at ranks them at
       random while the section promises novelty. The shop's article numbers do
       climb over time (16xxx before 17xxx), which makes them the only signal of
       age the old site actually carries. All of them are five digits, so a
       string sort matches a numeric one.

       This is a stand-in. Ask the client whether the bulk module should carry a
       real "new in" flag or date, and use that instead. */
    const newest = await listProducts({ regionId, limit: 4, order: "-external_id" });

    return { newArrivals: newest.products, categoryTiles };
  } catch {
    return { newArrivals: [], categoryTiles: [] };
  }
}

export default async function HomePage() {
  const { newArrivals, categoryTiles } = await loadProducts();

  return (
    <>
      <SiteHeader overlay />
      {/* The home page sits outside the catalogue layout, so it has no
          template to animate it. The same wave, applied to its sections. */}
      <main className="rp-wave">
        <Hero
          posterSrc="https://picsum.photos/seed/redpoint-hero-autumn/2400/1350"
          posterAlt="Мъж с яке и дънки на градска улица"
          headline={["Есен", "2026"]}
          subtext="Новите модели вече са в трите магазина и онлайн."
          cta={{ label: "разгледай колекцията", href: "/men" }}
        />

        <CategoryCarousel title="Категории" tiles={categoryTiles} />

        <Manifesto items={MANIFESTO} />

        <ProductGrid
          title="Нови постъпления"
          products={newArrivals}
          viewAll={{ label: "виж всички", href: "/men" }}
        />

        <Stores title="Магазини" stores={STORES} />
      </main>

      <SiteFooter />
      <ChatPanel />
    </>
  );
}
