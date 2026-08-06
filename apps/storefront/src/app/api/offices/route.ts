import { NextResponse } from "next/server";
import { medusaFetch } from "@/lib/medusa";

/**
 * Courier offices in one town, for the picker in checkout.
 *
 * One route for both couriers rather than one each. They answer in the same
 * shape by the time the backend is done with them, and the only thing that
 * differs is which of them is asked — so the courier is a parameter, not a
 * second file that drifts from the first.
 *
 * A thin route rather than the browser calling Medusa directly. The publishable
 * key is public and could go to the client, but every other catalogue read in
 * this storefront happens server-side, and one component reaching past that is
 * how a pattern stops being a pattern.
 */

const COURIERS = new Set(["econt", "speedy"]);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const city = params.get("city") ?? "";
  const courier = params.get("courier") ?? "";

  if (!COURIERS.has(courier)) {
    return NextResponse.json({ offices: [], message: "Непознат куриер." }, { status: 400 });
  }

  try {
    const data = await medusaFetch<{ offices: unknown[] }>(`/store/${courier}/offices`, { city });
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
