import type { Metadata } from "next";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { HelpPage, HelpSection, HelpText } from "@/components/help/help-page";
import { STORES } from "@/lib/home";

export const metadata: Metadata = {
  title: "Контакти · Red Point",
  description: "Трите магазина на Red Point във Варна — адреси, телефони и работно време.",
};

export default function ContactPage() {
  return (
    <HelpPage
      title="Контакти"
      intro="Три магазина във Варна. Обадете се на който ви е най-близо — дрехите са пред тях."
    >
      {STORES.map((store) => (
        <HelpSection key={store.name} title={store.name}>
          <address className="flex flex-col gap-1 not-italic">
            <span className="font-body text-body text-body-text">{store.address}</span>
            <a
              href={`tel:${store.phone.replace(/\s/g, "")}`}
              className="font-body text-nav text-primary underline"
            >
              {store.phone}
            </a>
            <span className="font-body text-body text-muted-text">
              Всеки ден {store.hours}
            </span>
          </address>
          <a
            href={store.mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-fit items-center gap-1 font-body text-control text-primary underline"
          >
            отвори в google maps
            <ArrowUpRight size={16} aria-hidden />
          </a>
        </HelpSection>
      ))}

      <HelpSection title="За поръчка">
        <HelpText>
          Ако въпросът е за конкретна поръчка, отговорете на имейла с
          потвърждението — там е номерът ѝ и намираме я веднага.
        </HelpText>
      </HelpSection>
    </HelpPage>
  );
}
