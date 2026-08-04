import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

/**
 * Shell for every catalogue page.
 *
 * The header is solid here, unlike on the home page where it floats over the
 * hero. Content starts below it rather than under it, so nothing important is
 * hidden behind a fixed bar.
 */
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="pt-14 md:pt-16">{children}</main>
      <SiteFooter />
    </>
  );
}
