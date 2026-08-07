import { NextResponse } from "next/server";
import { medusaMutate } from "@/lib/medusa";
import { googleSignInEnabled } from "@/lib/customer";

/**
 * The first half of "влез с Google": ask Medusa where to send them.
 *
 * Medusa answers with a `location` — Google's consent screen, carrying the
 * client id and the callback and a state parameter it will check on the way
 * back. We do not build that URL ourselves; it is signed state and guessing at
 * its shape is how the callback fails with an error on Google's page rather
 * than ours.
 *
 * A route rather than a button that posts, because what has to happen is a
 * redirect to another origin, and a fetch cannot do that from the browser.
 */
export async function GET() {
  if (!googleSignInEnabled()) {
    return NextResponse.redirect(new URL("/account/login", process.env.SITE_URL ?? "http://localhost:3000"));
  }

  try {
    const { location } = await medusaMutate<{ location: string }>("/auth/customer/google", {});
    if (!location) throw new Error("no location");
    return NextResponse.redirect(location);
  } catch {
    /* Back to the login page with something to read. Google being
       misconfigured must not look like a broken shop. */
    const url = new URL("/account/login", process.env.SITE_URL ?? "http://localhost:3000");
    url.searchParams.set("error", "google");
    return NextResponse.redirect(url);
  }
}
