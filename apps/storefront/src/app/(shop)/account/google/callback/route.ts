import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { medusaFetch, medusaMutate } from "@/lib/medusa";

/**
 * The second half of "влез с Google": Google sends them back here.
 *
 * This URL is what has to be registered in Google Cloud Console as an
 * authorised redirect URI, character for character. A mismatch is Google's own
 * redirect_uri_mismatch error page, which the shopper sees instead of the shop
 * and which says nothing about what to do.
 *
 * The code arrives in the query string. Medusa exchanges it for a token, and
 * the token becomes the same httpOnly session cookie the email login sets —
 * from here on the two are indistinguishable.
 *
 * A first-time Google sign-in has a token but no customer record behind it, so
 * one is created from what Google gave us. Without that, somebody signs in
 * successfully and the shop has no name and no email to write to.
 */

const SESSION_COOKIE = "rp_session";
const SESSION_MAX_AGE = 60 * 60 * 24;

function backTo(path: string, params?: Record<string, string>) {
  const url = new URL(path, process.env.SITE_URL ?? "http://localhost:3000");
  for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;

  /* Google reports a refusal here too — somebody pressing "Cancel" on the
     consent screen arrives with `error=access_denied` and no code. That is not
     a failure worth an error message; they simply changed their mind. */
  if (query.get("error")) return backTo("/account/login");

  const search = query.toString();
  if (!search) return backTo("/account/login", { error: "google" });

  try {
    const { token } = await medusaMutate<{ token: string }>(
      `/auth/customer/google/callback?${search}`,
      { method: "POST" },
    );
    if (!token) throw new Error("no token");

    /* Does a customer already exist behind this login? A second sign-in does;
       the first does not, and Medusa answers 404 rather than creating one. */
    let known = true;
    try {
      await medusaFetch("/store/customers/me", {}, { token });
    } catch {
      known = false;
    }

    let session = token;

    if (!known) {
      await medusaMutate("/store/customers", { body: {} }, { token });

      /* The same trap as email registration: the token was issued before the
         customer existed and carries an empty actor_id, so it is refused by
         every /store route that needs to know who is asking. Refreshed against
         the customer that now exists. */
      const refreshed = await medusaMutate<{ token: string }>(
        "/auth/token/refresh",
        {},
        { token },
      );
      if (refreshed.token) session = refreshed.token;
    }

    (await cookies()).set(SESSION_COOKIE, session, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });

    return backTo("/account");
  } catch {
    return backTo("/account/login", { error: "google" });
  }
}
