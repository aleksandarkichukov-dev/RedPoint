import { defineRouteConfig } from "@medusajs/admin-sdk";
import { ExclamationCircle } from "@medusajs/icons";
import { Button, Container, Table, Text } from "@medusajs/ui";
import { useEffect, useState } from "react";

/**
 * Card orders that were never paid.
 *
 * A screen rather than a badge somewhere, because the useful action is a phone
 * call and a phone call needs a number, a name and an amount on one line.
 *
 * It lists and does nothing else. No cancel button: writing an order off is a
 * decision with a customer on the other end of it, and the one order most
 * likely to be cancelled by a tired hand at closing time is the one where the
 * card failed twice and the shopper rang the shop about it.
 */

interface UnpaidOrder {
  id: string;
  displayId: number;
  email: string;
  createdAt: string;
  total: number;
  currencyCode: string;
  name: string;
  phone: string | null;
}

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("bg-BG", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount);

/** "преди 3 часа" reads faster than a timestamp when the age is the point. */
const age = (iso: string) => {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 90) return `преди ${minutes} мин.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `преди ${hours} ч.`;
  return `преди ${Math.floor(hours / 24)} дни`;
};

const UnpaidPage = () => {
  const [orders, setOrders] = useState<UnpaidOrder[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/admin/orders/unpaid", { credentials: "include" })
      .then((response) => response.json())
      .then((data) => setOrders(data.orders ?? []))
      .catch(() => setFailed(true));
  }, []);

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-col gap-2 px-6 py-4">
        <h1 className="txt-large-plus text-ui-fg-base">Неплатени поръчки</h1>
        <Text size="small" className="text-ui-fg-subtle">
          Поръчки с плащане с карта, при които парите така и не пристигнаха —
          клиентът е стигнал до myPOS и е затворил страницата. Поръчките с
          наложен платеж не влизат тук; те са неплатени по замисъл.
        </Text>
      </div>

      <div className="px-6 py-4">
        {failed && <Text size="small">Списъкът не се зареди.</Text>}
        {!failed && orders === null && <Text size="small">Зареждаме…</Text>}

        {orders?.length === 0 && (
          <Text size="small" className="text-ui-fg-subtle">
            Няма такива поръчки. Всичко платено с карта си е платено.
          </Text>
        )}

        {orders && orders.length > 0 && (
          <>
            <Text size="small" className="text-ui-fg-subtle">
              Обадете се на клиента. Ако иска, оставете поръчката с наложен
              платеж; ако се откаже, отменете я от самата поръчка.
            </Text>
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell className="w-20">№</Table.HeaderCell>
                  <Table.HeaderCell>Клиент</Table.HeaderCell>
                  <Table.HeaderCell className="w-40">Телефон</Table.HeaderCell>
                  <Table.HeaderCell className="w-32">Сума</Table.HeaderCell>
                  <Table.HeaderCell className="w-32">Отпреди</Table.HeaderCell>
                  <Table.HeaderCell className="w-24" />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {orders.map((order) => (
                  <Table.Row key={order.id}>
                    <Table.Cell>{order.displayId}</Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-col">
                        <span>{order.name || "—"}</span>
                        <span className="text-ui-fg-subtle">{order.email}</span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      {order.phone ? (
                        <a href={`tel:${order.phone}`} className="underline">
                          {order.phone}
                        </a>
                      ) : (
                        "—"
                      )}
                    </Table.Cell>
                    <Table.Cell>{money(order.total, order.currencyCode)}</Table.Cell>
                    <Table.Cell>{age(order.createdAt)}</Table.Cell>
                    <Table.Cell>
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => {
                          window.location.href = `/app/orders/${order.id}`;
                        }}
                      >
                        Отвори
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </>
        )}
      </div>
    </Container>
  );
};

export const config = defineRouteConfig({
  label: "Неплатени поръчки",
  icon: ExclamationCircle,
});

export default UnpaidPage;
