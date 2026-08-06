import { defineWidgetConfig } from "@medusajs/admin-sdk";
import type { DetailWidgetProps, AdminOrder } from "@medusajs/framework/types";
import { Button, Container, Text, toast } from "@medusajs/ui";
import { useState } from "react";

/**
 * Issuing the Econt waybill, on the order it belongs to.
 *
 * A widget on the order rather than a screen of its own. The shop is looking at
 * the order when they decide to send it, and a separate screen would mean
 * copying an order number between two places — which is how the wrong parcel
 * gets sent to the right address.
 *
 * The button asks first. It is the one control in this admin that costs money
 * and brings a courier, and a confirm step is cheap next to that. Once issued,
 * the number and the print link replace the button: there is nothing left to
 * press, which is a better guard than a disabled button nobody trusts.
 */

interface Waybill {
  number: string;
  pdfUrl: string | null;
}

const EcontWaybillWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const metadata = (order.metadata ?? {}) as Record<string, unknown>;
  const existing =
    typeof metadata.econt_waybill === "string"
      ? {
          number: metadata.econt_waybill,
          pdfUrl:
            typeof metadata.econt_waybill_pdf === "string" ? metadata.econt_waybill_pdf : null,
        }
      : null;

  const [waybill, setWaybill] = useState<Waybill | null>(existing);
  const [busy, setBusy] = useState(false);
  /* Confirmation lives in the widget, not in `window.confirm`. The browser
     suppressed the native dialog here — the first press did nothing at all,
     with no request and no error, because a blocked confirm reads as "no".
     An asking-state cannot be blocked and cannot be silent. */
  const [asking, setAsking] = useState(false);

  const shipping = order.shipping_methods?.[0]?.name ?? "";
  const isEcont = /еконт/i.test(shipping);

  const issue = async () => {
    setBusy(true);
    try {
      const response = await fetch(`/admin/orders/${order.id}/econt-waybill`, {
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
      toast.error("Връзката със сървъра прекъсна. Проверете в Еконт, преди да опитате пак.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between gap-4 px-6 py-4">
        <h2 className="txt-large-plus text-ui-fg-base">Еконт</h2>
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
              Товарителница <strong>{waybill.number}</strong> е издадена.
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
            {/* No cancel button. Econt only allow it before the courier has the
                parcel, and the shop knows what happened in the last hour better
                than this screen does — a button that fails half the time
                teaches people to ignore what it says. */}
            <Text size="small" className="text-ui-fg-subtle">
              За отказ се обадете на Еконт — възможно е само докато пратката още
              е при тях.
            </Text>
          </>
        ) : !isEcont ? (
          <Text size="small" className="text-ui-fg-subtle">
            {shipping
              ? `Доставката е „${shipping}". Товарителница за Еконт се издава само за поръчки с Еконт.`
              : "Поръчката още няма избран начин на доставка."}
          </Text>
        ) : (
          <>
            <Text size="small" className="text-ui-fg-subtle">
              Създава истинска пратка. Куриерът идва да я вземе, а сумата за
              наложен платеж се взима от клиента при получаване.
            </Text>

            {asking ? (
              <div className="flex flex-col gap-3">
                <Text size="small" weight="plus">
                  Издаване на товарителница за поръчка № {order.display_id}. Куриер
                  ще дойде да я вземе. Сигурни ли сте?
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

export default EcontWaybillWidget;
