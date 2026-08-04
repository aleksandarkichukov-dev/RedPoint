import { CampaignBand } from "@/components/home/campaign-band";
import { CategoryCarousel } from "@/components/home/category-carousel";
import { Hero } from "@/components/home/hero";
import { Manifesto } from "@/components/home/manifesto";
import { ProductGrid } from "@/components/home/product-grid";
import { SaleRail } from "@/components/home/sale-rail";
import { Stores } from "@/components/home/stores";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import {
  CATEGORY_TILES,
  MANIFESTO,
  NEW_ARRIVALS,
  ON_SALE,
  STORES,
} from "@/lib/home";

/**
 * Home page, all nine sections of the Phase 3 brief.
 *
 * The two product sections run on placeholder data until the catalogue is
 * seeded; they already take the shape Medusa will return, so Phase 4 swaps the
 * source and nothing else.
 */
export default function HomePage() {
  return (
    <>
      <SiteHeader overlay />
      <main>
        <Hero
          posterSrc="https://picsum.photos/seed/redpoint-hero-autumn/2400/1350"
          posterAlt="Мъж с яке и дънки на градска улица"
          headline={["Есен", "2026"]}
          subtext="Новите модели вече са в трите магазина и онлайн."
          cta={{ label: "разгледай колекцията", href: "/men" }}
        />

        <CategoryCarousel title="Категории" tiles={CATEGORY_TILES} />

        <Manifesto items={MANIFESTO} />

        <ProductGrid
          title="Нови постъпления"
          products={NEW_ARRIVALS}
          viewAll={{ label: "виж всички", href: "/men" }}
        />

        <CampaignBand
          imageSrc="https://picsum.photos/seed/redpoint-campaign-band/2400/1200"
          imageAlt="Кампанийна снимка на есенната колекция"
          headline="До 50% на избрани модели"
          saleLabel="разпродажба"
          cta={{ label: "към разпродажбата", href: "/sale" }}
        />

        <SaleRail
          title="Разпродажба"
          products={ON_SALE}
          viewAll={{ label: "виж всички", href: "/sale" }}
        />

        <Stores title="Магазини" stores={STORES} />
      </main>

      <SiteFooter />
    </>
  );
}
