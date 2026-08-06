import { STORES } from "@/lib/home";
import { absolute, SITE_URL } from "@/lib/site";

/**
 * The block of machine-readable facts a search engine reads instead of guessing.
 *
 * This is what puts "19,00 € · В наличност" under a result rather than the
 * first line of the description. Google does not infer a price from layout —
 * it reads it from here or not at all.
 *
 * Rendered as a script tag on the server, so it costs the browser nothing and
 * cannot fall out of step with what the page shows: both come from the same
 * props.
 */

function Script({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      /* JSON.stringify escapes nothing HTML-significant, and a product title
         containing `</script>` would end the tag early. Rare, but it is a
         script tag built from catalogue text the shop edits daily. */
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

export interface ProductJsonLdProps {
  name: string;
  description: string | null;
  images: string[];
  /** The article number from the label, which is what a shopper quotes. */
  sku: string | null;
  price: number;
  inStock: boolean;
  href: string;
  material: string | null;
}

export function ProductJsonLd(product: ProductJsonLdProps) {
  return (
    <Script
      data={{
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        ...(product.description ? { description: product.description } : {}),
        image: product.images.map((image) => absolute(image)),
        ...(product.sku ? { sku: product.sku, mpn: product.sku } : {}),
        ...(product.material ? { material: product.material } : {}),
        brand: { "@type": "Brand", name: "Red Point" },
        offers: {
          "@type": "Offer",
          url: absolute(product.href),
          priceCurrency: "EUR",
          price: product.price.toFixed(2),
          availability: product.inStock
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
          itemCondition: "https://schema.org/NewCondition",
          seller: { "@type": "Organization", name: "Red Point" },
        },
      }}
    />
  );
}

/**
 * The shop itself, and its three counters.
 *
 * Three `ClothingStore` entries with addresses, phones and opening hours, which
 * is what puts a shop on the map panel for "мъжки дрехи Варна". A business with
 * three physical addresses in one city has something to say here that an
 * online-only competitor does not.
 */
export function OrganizationJsonLd() {
  return (
    <Script
      data={{
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Red Point",
        url: SITE_URL,
        description: "Мъжка спортно-елегантна мода. Три магазина във Варна.",
        department: STORES.map((store) => ({
          "@type": "ClothingStore",
          name: `Red Point ${store.name}`,
          telephone: store.phone,
          address: {
            "@type": "PostalAddress",
            streetAddress: store.address,
            addressLocality: "Варна",
            addressCountry: "BG",
          },
          /* One range for every day, because that is what these shops keep.
             Written as a spec rather than as prose so it is read rather than
             displayed. */
          openingHoursSpecification: {
            "@type": "OpeningHoursSpecification",
            dayOfWeek: [
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
              "Sunday",
            ],
            opens: store.hours.split(" - ")[0],
            closes: store.hours.split(" - ")[1],
          },
        })),
      }}
    />
  );
}
