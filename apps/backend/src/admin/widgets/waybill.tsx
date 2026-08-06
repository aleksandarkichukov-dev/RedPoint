import { defineWidgetConfig } from "@medusajs/admin-sdk";
import type { DetailWidgetProps, AdminOrder } from "@medusajs/framework/types";
import { Button, Container, Text, toast } from "@medusajs/ui";
import { useState } from "react";

/**
 * Issuing the waybill, on the order it belongs to.
 *
 * A widget on the order rather than a screen of its own. The shop is looking at
 * the order when they decide to send it, and a separate screen would mean
 * copying an order number between two places — which is how the wrong parcel
 * gets sent to the right address.
 *
 * One widget for both couriers. It reads which one from the shipping method's
 * name, the same string the shopper chose and the route reads, so the three
 * cannot disagree about who is carrying the parcel.
 *
 * The button asks first. It is the one control in this admin that costs money
 * and brings a courier, and a confirm step is cheap next to that. Once issued,
 * the number replaces the button: there is nothing left to press, which guards
 * better than a disabled button nobody trusts.
 */

interface Waybill {
  number: string;
  courier: string;
  pdfUrl: string | null;
}

const COURIER_NAMES: Record<string, string> = { econt: "Еконт", speedy: "Спиди" };

const WaybillWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const metadata = (order.metadata ?? {}) as Record<string, unknown>;

  /* `econt_waybill` is what the earlier Econt-only version wrote. Read so an
     order issued before this widget keeps showing its number rather than
     offering to send a second parcel. */
  const stored =
    typeof metadata.waybill === "string"
      ? metadata.waybill
      : typeof metadata.econt_waybill === "string"
        ? metadata.econt_waybill
        : null;

  const [waybill, setWaybill] = useState<Waybill | null>(
    stored
      ? {
          number: stored,
          courier: typeof metadata.waybill_courier === "string" ? metadata.waybill_courier : "econt",
          pdfUrl:
            typeof metadata.waybill_pdf === "string"
              ? metadata.waybill_pdf
              : typeof metadata.econt_waybill_pdf === "string"
                ? metadata.econt_waybill_pdf
                : null,
        }
      : null,
  );
  const [busy, setBusy] = useState(false);
  /* Confirmation lives in the widget, not in `window.confirm`. The browser
     suppressed the native dialog here — the first press did nothing at all,
     with no request and no error, because a blocked confirm reads as "no".
     An asking-state cannot be blocked and cannot be silent. */
  const [asking, setAsking] = useState(false);

  const shipping = order.shipping_methods?.[0]?.name ?? "";
  const courier = /еконт/i.test(shipping) ? "econt" : /спиди/i.test(shipping) ? "speedy" : null;
  const courierName = courier ? COURIER_NAMES[courier] : null;

  const issue = async () => {
    setBusy(true);
    try {
      const response = await fetch(`/admin/orders/${order.id}/waybill`, {
        method: "POST",
        credentials: "include",
      });
      const result = await response.json();

      if (!response.ok) {
        toast.error(result.message ?? "Товарителницата не беше издадена.");
        return;
      }

      setWaybill(result.waybill);
      setAsking(false);
      toast.success(
        result.alreadyIssued
          ? `Тази поръчка вече има товарителница ${result.waybill.number}.`
          : `Товарителница ${result.waybill.number} е издадена.`,
      );
    } catch {
      toast.error("Връзката със сървъра прекъсна. Проверете при куриера, преди да опитате пак.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between gap-4 px-6 py-4">
        <h2 className="txt-large-plus text-ui-fg-base">
          {courierName ?? "Доставка"}
        </h2>
        {waybill && (
          <Text size="small" className="text-ui-fg-subtle">
            {waybill.number}
          </Text>
        )}
      </div>

      <div className="flex flex-col gap-3 px-6 py-4">
        {waybill ? (
          <>
            <Text size="small">
              Товарителница <strong>{waybill.number}</strong> е издадена
              {COURIER_NAMES[waybill.courier] ? ` със ${COURIER_NAMES[waybill.courier]}` : ""}.
            </Text>
            {waybill.pdfUrl && (
              <a
                href={waybill.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="text-ui-fg-interactive txt-small w-fit underline"
              >
                Отвори за печат
              </a>
            )}
            {/* No cancel button. Both couriers allow it only before the parcel
                is collected, and the shop knows what happened in the last hour
                better than this screen does — a button that fails half the time
                teaches people to ignore what it says. */}
            <Text size="small" className="text-ui-fg-subtle">
              За отказ се обадете на куриера — възможно е само докато пратката
              още е при тях.
            </Text>
          </>
        ) : !courier ? (
          <Text size="small" className="text-ui-fg-subtle">
            {shipping
              ? `Доставката е „${shipping}". Товарителница се издава само за Еконт и Спиди.`
              : "Поръчката още няма избран начин на доставка."}
          </Text>
        ) : (
          <>
            <Text size="small" className="text-ui-fg-subtle">
              Създава истинска пратка със {courierName}. Куриерът идва да я
              вземе, а сумата за наложен платеж се взима от клиента при
              получаване.
            </Text>

            {asking ? (
              <div className="flex flex-col gap-3">
                <Text size="small" weight="plus">
                  Издаване на товарителница за поръчка № {order.display_id} със{" "}
                  {courierName}. Куриер ще дойде да я вземе. Сигурни ли сте?
                </Text>
                <div className="flex gap-2">
                  <Button variant="primary" onClick={issue} isLoading={busy}>
                    Да, издай
                  </Button>
                  <Button variant="secondary" onClick={() => setAsking(false)} disabled={busy}>
                    Откажи
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="primary" onClick={() => setAsking(true)} className="w-fit">
                Издай товарителница
              </Button>
            )}
          </>
        )}
      </div>
    </Container>
  );
};

export const config = defineWidgetConfig({
  zone: "order.details.after",
});

export default WaybillWidget;
