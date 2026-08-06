import { NextResponse } from "next/server";
import { medusaFetch } from "@/lib/medusa";

/**
 * The office list, for the picker in checkout.
 *
 * A thin route rather than the browser calling Medusa directly. The
 * publishable key is public and could go to the client, but every other
 * catalogue read in this storefront happens server-side, and one component
 * reaching past that is how a pattern stops being a pattern.
 */
export async function GET(request: Request) {
  const city = new URL(request.url).searchParams.get("city") ?? "";

  try {
    const data = await medusaFetch<{ offices: unknown[] }>("/store/econt/offices", { city });
    return NextResponse.json(data);
  } catch {
    /* The courier being unreachable must not read as our failure. Checkout
       still works — the shop's shipping prices are flat, so an order can be
       placed and paid; what is lost is picking an office from a live list. */
    return NextResponse.json(
      { offices: [], message: "Списъкът с офиси не се зареди." },
      { status: 503 },
    );
  }
}
