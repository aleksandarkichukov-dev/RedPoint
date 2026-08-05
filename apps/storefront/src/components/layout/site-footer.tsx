import Link from "next/link";
import { NewsletterForm } from "@/components/layout/newsletter-form";
import { Wordmark } from "@/components/layout/wordmark";
import { NAV_GROUPS } from "@/lib/navigation";
import { STORES } from "@/lib/home";

const HELP_LINKS = [
  { label: "Доставка", href: "/help/delivery" },
  { label: "Връщане и замяна", href: "/help/returns" },
  { label: "Таблица с размери", href: "/help/sizes" },
  { label: "Контакти", href: "/help/contact" },
];

const LEGAL_LINKS = [
  { label: "Общи условия", href: "/legal/terms" },
  { label: "Поверителност", href: "/legal/privacy" },
  { label: "Бисквитки", href: "/legal/cookies" },
];

/** Black panel, uppercase headings, hairline divisions and nothing else. */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-primary text-white">
      <div className="mx-auto max-w-(--container-page) px-4 md:px-8">
        <NewsletterForm />

        <div className="grid grid-cols-2 gap-8 border-t border-white/15 py-12 md:grid-cols-4">
          <FooterColumn
            title="Мъже"
            links={NAV_GROUPS[0]?.columns.flatMap((column) => column.links).slice(0, 6) ?? []}
          />
          <FooterColumn title="Помощ" links={HELP_LINKS} />
          <FooterColumn title="Условия" links={LEGAL_LINKS} />

          <div className="flex flex-col gap-3">
            <span className="font-headline text-subhead font-bold text-white uppercase">
              Магазини
            </span>
            <ul className="flex flex-col gap-2">
              {STORES.map((store) => (
                <li key={store.name} className="font-body text-body text-white/70">
                  {store.name}
                  <span className="block text-white/45">{store.hours}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/15 py-8 md:flex-row md:items-center md:justify-between">
          {/* The one surface where the mark is exactly as the client draws it:
              white letters, red disc, strapline, on black. */}
          <Wordmark className="text-subhead" tagline />
          <span className="font-body text-body text-white/45">
            {year} Red Point Варна. Всички права запазени.
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="font-headline text-subhead font-bold text-white uppercase">{title}</span>
      <ul className="flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="font-body text-body text-white/70 hover:text-white">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
