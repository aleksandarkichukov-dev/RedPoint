import Link from "next/link";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { buttonClasses } from "@/components/ui/button";
import { NAV_GROUPS } from "@/lib/navigation";

/**
 * 404, for a category or product that does not exist and for any unknown URL.
 *
 * This page will get real traffic. The old site has ten years of indexed URLs
 * and Phase 9 maps them to new handles; anything the map misses lands here, so
 * it carries the navigation rather than being a dead end.
 */
export default function NotFound() {
  const links = NAV_GROUPS[0]?.columns.flatMap((column) => column.links).slice(0, 6) ?? [];

  return (
    <>
      <SiteHeader />
      <main className="pt-14 md:pt-16">
        <div className="mx-auto flex min-h-[60vh] w-full max-w-(--container-page) flex-col items-start justify-center gap-6 px-4 py-16 md:px-8">
          <p className="font-body text-nav text-muted-text">Грешка 404</p>
          <h1 className="text-display">Страницата не съществува</h1>

          <p className="max-w-[52ch] font-body text-nav text-body-text">
            Възможно е артикулът да е изчерпан и свален от сайта, или адресът да
            е сгрешен.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <Link href="/men" className={buttonClasses("solid")}>
              разгледай мъжката колекция
            </Link>
            <Link href="/" className="font-body text-nav text-primary underline underline-offset-4">
              към началната страница
            </Link>
          </div>

          {links.length > 0 && (
            <nav aria-label="Популярни категории" className="mt-4 flex flex-col gap-3">
              <span className="font-body text-subhead text-border">Популярни категории</span>
              <ul className="flex flex-wrap gap-x-6 gap-y-2">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="font-body text-nav text-body-text underline underline-offset-4 hover:text-primary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
