import type { Metadata } from "next";
import Link from "next/link";
import { HelpPage, HelpSection, HelpText } from "@/components/help/help-page";

export const metadata: Metadata = {
  title: "Таблица с размери · Red Point",
  description: "Как да мерите и как да четете таблицата с размери на всеки артикул.",
};

/**
 * Deliberately not a universal size table.
 *
 * Every product carries its own chart, measured in the shop on that garment —
 * an S from one make is not an S from another, and a single table on this page
 * would contradict the numbers on the product page it is meant to explain. So
 * this page teaches the method and sends people to the garment.
 */
export default function SizesPage() {
  return (
    <HelpPage
      title="Таблица с размери"
      intro="Всяка дреха има собствена таблица, снета от нея в магазина."
    >
      <HelpSection title="Къде е таблицата">
        <HelpText>
          На страницата на всяка дреха, под размерите, пише „виж таблицата с
          размери“. Там са мерките на този конкретен артикул в сантиметри.
        </HelpText>
        <HelpText>
          Няма обща таблица нарочно. S при един производител не е S при друг, а
          дрехите тук са от различни марки. Една обща таблица би противоречала
          на числата, които сте видели на самата дреха.
        </HelpText>
      </HelpSection>

      <HelpSection title="Какво значат двете колони">
        <table className="w-full border-collapse">
          <tbody>
            <tr className="border-b border-border">
              <td className="w-32 py-2 font-body text-body text-primary">Ширина</td>
              <td className="py-2 font-body text-body text-body-text">
                От единия шев под мишницата до другия, дрехата легнала на
                равно. Това е половин обиколка.
              </td>
            </tr>
            <tr className="border-b border-border">
              <td className="py-2 font-body text-body text-primary">Дължина</td>
              <td className="py-2 font-body text-body text-body-text">
                От най-високата точка на рамото право надолу до долния ръб.
              </td>
            </tr>
          </tbody>
        </table>
      </HelpSection>

      <HelpSection title="Най-сигурният начин">
        <HelpText>
          Вземете дреха, която ви стои както искате, разстелете я на маса и я
          премерете по същия начин. Сравнете тези две числа с таблицата. Това
          лъже по-малко от мерене по тялото.
        </HelpText>
      </HelpSection>

      <HelpSection title="Ако сте между два размера">
        <HelpText>
          Обадете се на{" "}
          <Link href="/help/contact" className="underline">
            някой от магазините
          </Link>
          . Дрехата е пред тях и могат да я премерят отново или да кажат как
          стои. Ако все пак не познаете,{" "}
          <Link href="/help/returns" className="underline">
            замяната на размер
          </Link>{" "}
          е безплатна в магазин.
        </HelpText>
      </HelpSection>
    </HelpPage>
  );
}
