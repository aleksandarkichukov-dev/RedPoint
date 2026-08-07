import type { Metadata } from "next";
import Link from "next/link";
import { HelpPage, HelpSection, HelpText } from "@/components/help/help-page";
import { formatBgn, formatEur } from "@/lib/price";

export const metadata: Metadata = {
  title: "Доставка",
  description: "Доставка със Спиди и Еконт до офис или адрес в цяла България.",
};

/* The same figures the checkout charges. They are flat by the client's own
   decision, so there is one number per option and no weight to explain. */
const TO_OFFICE = 2.55;
const TO_ADDRESS = 3.06;

export default function DeliveryPage() {
  return (
    <HelpPage
      title="Доставка"
      intro="Изпращаме със Спиди и Еконт до всяко населено място в България."
    >
      <HelpSection title="Цени">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-2 font-body text-body font-semibold">Начин</th>
              <th className="py-2 font-body text-body font-semibold">Цена</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border">
              <td className="py-2 font-body text-body text-primary">До офис на куриера</td>
              <td className="py-2 font-body text-body text-body-text">
                {formatEur(TO_OFFICE)} ({formatBgn(TO_OFFICE)})
              </td>
            </tr>
            <tr className="border-b border-border">
              <td className="py-2 font-body text-body text-primary">До адрес</td>
              <td className="py-2 font-body text-body text-body-text">
                {formatEur(TO_ADDRESS)} ({formatBgn(TO_ADDRESS)})
              </td>
            </tr>
          </tbody>
        </table>
        <HelpText>
          Цената е една и съща за двата куриера и не зависи от теглото или от
          броя на артикулите в поръчката.
        </HelpText>
      </HelpSection>

      <HelpSection title="Срок">
        <HelpText>
          Поръчките, направени до 16:00 в работен ден, тръгват същия ден и
          пристигат на следващия работен ден. Поръчка в събота или неделя тръгва
          в понеделник.
        </HelpText>
      </HelpSection>

      <HelpSection title="Плащане">
        <HelpText>
          Плащате с карта при поръчката или в брой на куриера при получаване.
          Наложеният платеж е без допълнителна такса — сумата е същата и по
          двата начина.
        </HelpText>
      </HelpSection>

      <HelpSection title="Вземане от магазин">
        <HelpText>
          Ако сте във Варна, можете да минете през някой от{" "}
          <Link href="/help/contact" className="underline">
            трите магазина
          </Link>
          . Обадете се предварително, за да проверим дали размерът е там.
        </HelpText>
      </HelpSection>
    </HelpPage>
  );
}
