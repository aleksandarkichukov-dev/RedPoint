import Image from "next/image";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

export interface HeroProps {
  /** Muted background loop. Until Phase 3's video exists, the poster carries
   *  the section on its own and dropping the file in changes nothing else. */
  videoSrc?: string;
  posterSrc: string;
  posterAlt: string;
  /** Split across lines deliberately: each one masks in separately. */
  headline: string[];
  subtext: string;
  cta: { label: string; href: string };
}

/**
 * Full-viewport opener.
 *
 * A Server Component on purpose. The mask reveal is CSS, the loop is a plain
 * muted `<video autoplay>`, and neither needs React on the client, so the most
 * expensive section of the page ships no JavaScript.
 */
export function Hero({
  videoSrc,
  posterSrc,
  posterAlt,
  headline,
  subtext,
  cta,
}: HeroProps) {
  return (
    <section className="relative flex min-h-[100dvh] flex-col justify-end overflow-hidden bg-primary">
      {videoSrc ? (
        <video
          autoPlay
          muted
          loop
          playsInline
          poster={posterSrc}
          aria-label={posterAlt}
          className="absolute inset-0 size-full object-cover grayscale contrast-125"
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      ) : (
        <Image
          src={posterSrc}
          alt={posterAlt}
          fill
          priority
          sizes="100vw"
          className="object-cover grayscale contrast-125"
        />
      )}

      {/* Scrim, not decoration. Ghost buttons and white type over unpredictable
          photography fail contrast without it. Bottom-weighted so the top of
          the frame stays as shot. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/10"
      />

      <div className="relative mx-auto flex w-full max-w-(--container-page) flex-col gap-6 px-4 pt-24 pb-16 md:px-8 md:pb-20">
        <h1 className="font-headline text-hero text-white uppercase">
          {headline.map((line, index) => (
            <span key={line} className="mask-line">
              <span style={{ animationDelay: `${index * 90}ms` }}>{line}</span>
            </span>
          ))}
        </h1>

        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-12">
          <p className="max-w-[38ch] font-body text-nav text-white">{subtext}</p>

          <Link href={cta.href} className={buttonClasses("onImage", "self-start shrink-0")}>
            {cta.label}
          </Link>
        </div>
      </div>

      {/* The brief asks for a discreet scroll cue. Rendered as a hairline that
          fills downward rather than the usual "Scroll" label or mouse-wheel
          glyph, both of which read as decoration. Hairlines are already this
          system's divider, so it costs no new vocabulary. */}
      <span
        aria-hidden
        className="absolute bottom-0 left-4 hidden h-16 w-px overflow-hidden bg-white/25 md:left-8 md:block"
      >
        <span className="block h-1/3 w-px animate-[rp-scroll-cue_2.4s_var(--ease-brand)_infinite] bg-white" />
      </span>
    </section>
  );
}
