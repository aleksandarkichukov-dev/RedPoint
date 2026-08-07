import "server-only";
import { cookies } from "next/headers";
import { medusaFetch, medusaMutate } from "@/lib/medusa";

/**
 * Customer accounts.
 *
 * An account is optional here and always will be: the shop takes orders from
 * anyone, and a checkout that demands a password loses the sale to somebody
 * who only wanted a jacket. What an account buys is not having to type an
 * address again and being able to look up what you ordered without an email
 * and an order number.
 *
 * Medusa hands back a JWT. It lives in an httpOnly cookie, so a script on the
 * page cannot read it — which is the difference between a stolen session and a
 * safe one, and the reason it is not in localStorage where the wishlist is.
 */

const SESSION_COOKIE = "rp_session";
/* Medusa's own tokens last 24h by default; the cookie outliving the token
   would leave somebody "logged in" to an account that answers 401. */
const SESSION_MAX_AGE = 60 * 60 * 24;

export interface Customer {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
}

interface AuthResponse {
  token: string;
}

async function setSession(token: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function getSessionToken(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * Whoever is logged in, or null.
 *
 * Never throws. Every layout that shows a name calls this, and a shop that
 * 500s because a token expired overnight is worse than a shop that shows the
 * login link again.
 */
export async function getCustomer(): Promise<Customer | null> {
  const token = await getSessionToken();
  if (!token) return null;

  try {
    const { customer } = await medusaFetch<{ customer: Record<string, unknown> }>(
      "/store/customers/me",
      {},
      { token },
    );

    return {
      id: String(customer.id),
      email: String(customer.email),
      firstName: (customer.first_name as string) ?? null,
      lastName: (customer.last_name as string) ?? null,
      phone: (customer.phone as string) ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Registration, which is three calls rather than one.
 *
 * `/auth/customer/emailpass/register` creates the login and hands back a
 * token; the customer record — the name, the email the shop writes to — is a
 * second call carrying it.
 *
 * The third call is the one that is easy to miss and impossible to see. The
 * token from step one carries an empty `actor_id`, because at that moment
 * there is no customer for it to point at. Creating the customer does not
 * change a token already issued, so keeping it means somebody who has just
 * registered is handed a session that `/store/customers/me` answers 401 to —
 * registration succeeds, the cookie is set, and the shop shows them logged
 * out. `/auth/token/refresh` re-issues it against the customer that now
 * exists. Verified rather than assumed: the first version of this function had
 * two calls and behaved exactly that way.
 */
export async function registerCustomer(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  let token: string;

  try {
    const auth = await medusaMutate<AuthResponse>("/auth/customer/emailpass/register", {
      body: { email: input.email, password: input.password },
    });
    token = auth.token;
  } catch (error) {
    /* Medusa answers the same way for "already registered" as for several
       other refusals, so the message is ours and says the useful thing. */
    const message = error instanceof Error ? error.message : "";
    return {
      ok: false,
      message: /exists|already/i.test(message)
        ? "Вече има профил с този имейл. Опитайте да влезете."
        : "Профилът не можа да бъде създаден. Проверете имейла и опитайте пак.",
    };
  }

  try {
    await medusaMutate(
      "/store/customers",
      {
        body: {
          email: input.email,
          first_name: input.firstName,
          last_name: input.lastName,
        },
      },
      { token },
    );
  } catch {
    return {
      ok: false,
      message: "Профилът беше създаден наполовина. Опитайте да влезете, или се обадете в магазина.",
    };
  }

  /* Re-issued against the customer that now exists. Without this the cookie
     holds a token with no actor behind it. */
  try {
    const refreshed = await medusaMutate<AuthResponse>(
      "/auth/token/refresh",
      {},
      { token },
    );
    if (refreshed.token) token = refreshed.token;
  } catch {
    /* Not fatal on its own: the account exists and logging in produces a good
       token. Better to say so than to leave them on a page that looks like it
       worked while the header says they are a stranger. */
    return {
      ok: false,
      message: "Профилът е създаден. Влезте с имейла и паролата си.",
    };
  }

  await setSession(token);
  return { ok: true };
}

export async function loginCustomer(
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const auth = await medusaMutate<AuthResponse>("/auth/customer/emailpass", {
      body: { email, password },
    });
    await setSession(auth.token);
    return { ok: true };
  } catch {
    /* One message for a wrong password and for an email with no account.
       Telling them apart tells anybody who asks which addresses have shopped
       here — the same reason the order lookup answers the same way. */
    return { ok: false, message: "Грешен имейл или парола." };
  }
}

/** Orders belonging to whoever is logged in. */
export async function listMyOrders(): Promise<
  { id: string; displayId: number; createdAt: string; total: number; status: string }[]
> {
  const token = await getSessionToken();
  if (!token) return [];

  try {
    const { orders } = await medusaFetch<{ orders: Record<string, any>[] }>(
      "/store/orders",
      { fields: "id,display_id,created_at,total,status,currency_code", limit: 50 },
      { token },
    );

    return orders.map((order) => ({
      id: String(order.id),
      displayId: Number(order.display_id),
      createdAt: String(order.created_at),
      total: Number(order.total ?? 0),
      status: String(order.status),
    }));
  } catch {
    return [];
  }
}

/** Whether "Влез с Google" has anything behind it. */
export function googleSignInEnabled(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID);
}
