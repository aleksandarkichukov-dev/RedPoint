import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";

export interface CampaignBandProps {
  imageSrc: string;
  imageAlt: string;
  headline: string;
  /** Rendered as a sale badge. This is the one section allowed the accent
   *  colour, and only because the message is genuinely about a reduction. */
  saleLabel?: string;
  cta: { label: string; href: string };
}

/**
 * Full-bleed campaign visual, the second and last one on the page.
 *
 * Structurally the opposite of the hero: shorter, centred, and carrying a
 * price message rather than a season. Splitting them like that is what stops
 * the page reading as two heroes.
 */
export function CampaignBand({
  imageSrc,
  imageAlt,
  headline,
  saleLabel,
  cta,
}: CampaignBandProps) {
  return (
    <section className="relative flex min-h-[70vh] items-center justify-center overflow-hidden bg-primary">
      <Image
        src={imageSrc}
        alt={imageAlt}
        fill
        sizes="100vw"
        className="object-cover grayscale contrast-125"
      />
      <div aria-hidden className="absolute inset-0 bg-black/45" />

      <div className="relative flex flex-col items-center gap-6 px-4 text-center">
        {saleLabel && <Badge variant="sale">{saleLabel}</Badge>}
        <h2 className="max-w-[16ch] font-headline text-[clamp(2.5rem,7vw,6rem)] leading-[0.9] text-white uppercase">
          {headline}
        </h2>
        <Link href={cta.href} className={buttonClasses("onImage")}>
          {cta.label}
        </Link>
      </div>
    </section>
  );
}
