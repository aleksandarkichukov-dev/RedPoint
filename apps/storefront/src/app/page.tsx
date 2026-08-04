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
  getCategoryByHandle,
  getRegionId,
  listProducts,
  type StoreProduct,
} from "@/lib/catalog";
import { CATEGORY_TILES, MANIFESTO, STORES } from "@/lib/home";

/**
 * Home page, all nine sections of the Phase 3 brief.
 *
 * The two product sections read the real catalogue. If the backend is down the
 * page still renders: the editorial sections stand on their own and the product
 * ones drop out, which is a far better failure than a 500 on the front page.
 */
async function loadProducts(): Promise<{
  newArrivals: StoreProduct[];
  onSale: StoreProduct[];
}> {
  try {
    const regionId = await getRegionId();
    const saleCategory = await getCategoryByHandle("men-sale");

    const [newest, sale] = await Promise.all([
      listProducts({ regionId, limit: 4, order: "-created_at" }),
      saleCategory
        ? listProducts({ regionId, categoryId: saleCategory.id, limit: 8 })
        : Promise.resolve({ products: [], count: 0, offset: 0, limit: 0 }),
    ]);

    return { newArrivals: newest.products, onSale: sale.products };
  } catch {
    return { newArrivals: [], onSale: [] };
  }
}

export default async function HomePage() {
  const { newArrivals, onSale } = await loadProducts();

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
          products={newArrivals}
          viewAll={{ label: "виж всички", href: "/men" }}
        />

        <CampaignBand
          imageSrc="https://picsum.photos/seed/redpoint-campaign-band/2400/1200"
          imageAlt="Кампанийна снимка на есенната колекция"
          headline="До 50% на избрани модели"
          saleLabel="разпродажба"
          cta={{ label: "към разпродажбата", href: "/men-sale" }}
        />

        <SaleRail
          title="Разпродажба"
          products={onSale}
          viewAll={{ label: "виж всички", href: "/men-sale" }}
        />

        <Stores title="Магазини" stores={STORES} />
      </main>

      <SiteFooter />
    </>
  );
}
