import { CategoryCarousel } from "@/components/home/category-carousel";
import { Hero } from "@/components/home/hero";
import { SiteHeader } from "@/components/layout/site-header";
import { CATEGORY_TILES } from "@/lib/home";

/**
 * Home page, built section by section as the brief asks.
 *
 * Done: 1 nav, 2 hero, 3 category carousel.
 * Next: 4 manifesto, 5 new arrivals, 6 campaign, 7 sale rail, 8 stores,
 *       9 newsletter and footer.
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
      </main>
    </>
  );
}
