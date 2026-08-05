import type { Metadata } from "next";
import Link from "next/link";
import { HelpPage, HelpSection, HelpText } from "@/components/help/help-page";

export const metadata: Metadata = {
  title: "Връщане и замяна · Red Point",
  description: "Връщане до 14 дни. Замяна на размер в трите магазина във Варна.",
};

export default function ReturnsPage() {
  return (
    <HelpPage
      title="Връщане и замяна"
      intro="Ако нещо не стане, връщате го до 14 дни от получаването."
    >
      <HelpSection title="Какво може да се върне">
        <HelpText>
          Дреха, която не е носена и не е прана, с етикетите по нея. Пробването
          вкъщи не е носене — точно за това са 14-те дни.
        </HelpText>
      </HelpSection>

      <HelpSection title="Как става">
        <HelpText>
          Обадете се на магазина, от който е най-удобно, или ни пишете. Казвате
          номера на поръчката и какво връщате, и се разбираме за куриера.
        </HelpText>
        <HelpText>
          Ако сте във Варна, най-бързо е да го донесете в{" "}
          <Link href="/help/contact" className="underline">
            някой от трите магазина
          </Link>
          . Замяната на размер става на място, ако другият размер е наличен.
        </HelpText>
      </HelpSection>

      <HelpSection title="Кога се връщат парите">
        <HelpText>
          След като получим дрехата и я прегледаме. Сумата се връща по същия
          начин, по който е платена.
        </HelpText>
      </HelpSection>

      <HelpSection title="Ако дрехата е дефектна">
        <HelpText>
          Обадете се веднага. Дефектна или сгрешена доставка се урежда за наша
          сметка — не чакайте 14-те дни да минат.
        </HelpText>
      </HelpSection>
    </HelpPage>
  );
}
