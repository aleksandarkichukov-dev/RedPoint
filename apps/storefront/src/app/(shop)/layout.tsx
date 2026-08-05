import { ChatPanel } from "@/components/chat/chat-panel";
import { BackLink } from "@/components/layout/back-link";
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
      {/* Matches the fixed bar's height exactly; if the two drift, the first
          heading on every catalogue page hides behind it. */}
      <main className="pt-16 md:pt-20">
        {/* In the layout rather than on each page: a back control that exists
            on some pages and not others is one a visitor stops looking for.

            Padded to the same gutter the pages use, so it sits on the content's
            left edge; from 2xl up it steps out into the margin, which is empty
            at that width and is where the eye already goes to leave. */}
        <div className="mx-auto w-full max-w-(--container-page) px-4 pt-6 md:px-8 2xl:px-0">
          <div className="2xl:-ml-16">
            <BackLink />
          </div>
        </div>
        {children}
      </main>
      <SiteFooter />
      <ChatPanel />
    </>
  );
}
