/* The peg and these two formatters also live in `@redpoint/catalog`, which is
   where the storefront reads them from, and importing them here would be the
   obvious thing to do.

   It does not work. `medusa develop` compiles with its own TypeScript program
   and reports "Module '@redpoint/catalog' has no exported member 'formatEur'"
   for exports the package plainly declares — running `tsc --noEmit` over this
   same tsconfig resolves them correctly and passes, and `--traceResolution`
   shows it landing on the right `dist/index.d.ts`. Older exports from the same
   package (CATEGORY_TREE, the colour helpers) import fine, so it is not the
   package or the workspace wiring.

   Rather than leave the emails blocked on a compiler quirk, the conversion is
   repeated here. The peg is fixed by law at 1.95583, so the drift this
   normally risks cannot happen — but if it ever changes, it changes in both
   places. */
const EUR_TO_BGN = 1.95583;

const eurFormatter = new Intl.NumberFormat("bg-BG", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

const bgnFormatter = new Intl.NumberFormat("bg-BG", {
  style: "currency",
  currency: "BGN",
  minimumFractionDigits: 2,
});

function formatEur(eur: number): string {
  return eurFormatter.format(eur);
}

/** Rounded UP to the stotinka, matching the storefront exactly. */
function formatBgn(eur: number): string {
  return bgnFormatter.format(Math.ceil(eur * EUR_TO_BGN * 100) / 100);
}

/**
 * The order confirmation email, in Bulgarian and English.
 *
 * A pure function of the order: no Medusa imports, no container, no network.
 * That is what makes it readable in a test and in a review, and it means the
 * wording can be changed without touching the subscriber that sends it.
 *
 * Written as tables with inline styles because that is what mail clients
 * render reliably. Outlook still lays out with tables and ignores most of a
 * stylesheet, so the design system's classes cannot reach here — the palette
 * is reproduced by hand and kept deliberately plain.
 */

export type Locale = "bg" | "en";

export interface OrderEmailLine {
  title: string;
  variant: string;
  quantity: number;
  total: number;
}

export interface OrderEmailData {
  displayId: number;
  itemTotal: number;
  shippingTotal: number;
  total: number;
  lines: OrderEmailLine[];
  shippingMethod: string | null;
  paymentMethod: string | null;
  address: {
    name: string;
    phone: string;
    city: string;
    postalCode: string;
    address: string;
  } | null;
  storeUrl: string;
}

const COPY = {
  bg: {
    subject: (id: number) => `Поръчка № ${id} е приета · Red Point`,
    greeting: "Благодарим за поръчката!",
    intro: (id: number) =>
      `Приехме поръчка № ${id}. Ще получите второ известие, когато я предадем на куриера.`,
    items: "Артикули",
    itemsTotal: "Артикули",
    shipping: "Доставка",
    total: "Общо",
    delivery: "Доставка до",
    payment: "Плащане",
    cod: "Наложен платеж — плащате на куриера при получаване",
    questions: "Въпроси?",
    contact: "Пишете ни на отговора на този имейл или се обадете на +359 89 247 5402.",
    shop: "към магазина",
    pieces: "бр.",
  },
  en: {
    subject: (id: number) => `Order #${id} confirmed · Red Point`,
    greeting: "Thank you for your order!",
    intro: (id: number) =>
      `We have received order #${id}. You will get a second notice when it is handed to the courier.`,
    items: "Items",
    itemsTotal: "Items",
    shipping: "Delivery",
    total: "Total",
    delivery: "Delivering to",
    payment: "Payment",
    cod: "Cash on delivery — you pay the courier on arrival",
    questions: "Questions?",
    contact: "Reply to this email or call +359 89 247 5402.",
    shop: "back to the shop",
    pieces: "pcs",
  },
} as const;

/** Mail clients are an untrusted rendering target for product names too. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(amount: number): string {
  return `${formatEur(amount)} (${formatBgn(amount)})`;
}

export function renderOrderEmail(
  order: OrderEmailData,
  locale: Locale = "bg",
): { subject: string; html: string; text: string } {
  const t = COPY[locale];

  const lineRows = order.lines
    .map(
      (line) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e4e6e7;">
            <div style="font-size:14px;color:#000;text-transform:uppercase;">${escapeHtml(line.title)}</div>
            <div style="font-size:13px;color:#68737d;">${escapeHtml(line.variant)} · ${line.quantity} ${t.pieces}</div>
          </td>
          <td style="padding:12px 0;border-bottom:1px solid #e4e6e7;text-align:right;white-space:nowrap;font-size:14px;font-weight:700;color:#212529;">
            ${formatEur(line.total)}
          </td>
        </tr>`,
    )
    .join("");

  const addressBlock = order.address
    ? `
      <h2 style="margin:32px 0 8px;font-size:16px;text-transform:uppercase;color:#000;">${t.delivery}</h2>
      <div style="font-size:13px;color:#212529;line-height:1.6;">
        ${escapeHtml(order.address.name)}<br>
        ${escapeHtml(order.address.postalCode)} ${escapeHtml(order.address.city)}<br>
        ${escapeHtml(order.address.address)}<br>
        ${escapeHtml(order.address.phone)}
        ${order.shippingMethod ? `<br><br>${escapeHtml(order.shippingMethod)}` : ""}
      </div>`
    : "";

  const html = `<!doctype html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f7f7f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;">
    <tr>
      <td style="padding:32px;">
        <div style="font-size:22px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#000;">
          RED&nbsp;P<span style="color:#c2311e;">&#9679;</span>INT
        </div>

        <h1 style="margin:28px 0 8px;font-size:26px;text-transform:uppercase;color:#000;">${t.greeting}</h1>
        <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#212529;">${t.intro(order.displayId)}</p>

        <h2 style="margin:0 0 4px;font-size:16px;text-transform:uppercase;color:#000;">${t.items}</h2>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #696969;">
          ${lineRows}
        </table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
          <tr>
            <td style="padding:4px 0;font-size:14px;color:#212529;">${t.itemsTotal}</td>
            <td style="padding:4px 0;text-align:right;font-size:14px;color:#212529;">${formatEur(order.itemTotal)}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:14px;color:#212529;">${t.shipping}</td>
            <td style="padding:4px 0;text-align:right;font-size:14px;color:#212529;">${formatEur(order.shippingTotal)}</td>
          </tr>
          <tr>
            <td style="padding:12px 0 0;border-top:1px solid #696969;font-size:16px;font-weight:700;text-transform:uppercase;color:#000;">${t.total}</td>
            <td style="padding:12px 0 0;border-top:1px solid #696969;text-align:right;font-size:16px;font-weight:700;color:#000;">${money(order.total)}</td>
          </tr>
        </table>

        ${addressBlock}

        ${
          order.paymentMethod
            ? `<h2 style="margin:32px 0 8px;font-size:16px;text-transform:uppercase;color:#000;">${t.payment}</h2>
               <div style="font-size:13px;color:#212529;">${escapeHtml(order.paymentMethod)}</div>`
            : ""
        }

        <p style="margin:32px 0 0;font-size:13px;color:#68737d;">
          <strong style="color:#000;">${t.questions}</strong> ${t.contact}
        </p>

        <a href="${order.storeUrl}" style="display:inline-block;margin-top:24px;padding:12px 20px;background:#000;color:#fff;text-decoration:none;font-size:14px;font-weight:600;">
          ${t.shop}
        </a>
      </td>
    </tr>
  </table>
</body>
</html>`;

  /* A text part is not decoration. Some clients show it instead of the HTML,
     and a mail with an empty one scores worse with spam filters. */
  const text = [
    t.greeting,
    "",
    t.intro(order.displayId),
    "",
    `${t.items}:`,
    ...order.lines.map(
      (line) => `- ${line.title} (${line.variant}) x${line.quantity}  ${formatEur(line.total)}`,
    ),
    "",
    `${t.itemsTotal}: ${formatEur(order.itemTotal)}`,
    `${t.shipping}: ${formatEur(order.shippingTotal)}`,
    `${t.total}: ${money(order.total)}`,
    ...(order.address
      ? [
          "",
          `${t.delivery}:`,
          order.address.name,
          `${order.address.postalCode} ${order.address.city}`,
          order.address.address,
          order.address.phone,
          ...(order.shippingMethod ? [order.shippingMethod] : []),
        ]
      : []),
    ...(order.paymentMethod ? ["", `${t.payment}: ${order.paymentMethod}`] : []),
    "",
    t.contact,
    order.storeUrl,
  ].join("\n");

  return { subject: t.subject(order.displayId), html, text };
}
