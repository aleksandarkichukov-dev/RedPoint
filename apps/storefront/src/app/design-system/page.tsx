import type { Metadata } from "next";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/ui/filter-bar";
import { Input } from "@/components/ui/input";
import { ProductCard } from "@/components/ui/product-card";

export const metadata: Metadata = {
  title: "Дизайн система",
  robots: { index: false, follow: false },
};

const COLOR_TOKENS = [
  { name: "primary", hex: "#000000", use: "заглавия, текст, навигация, кантове" },
  { name: "secondary", hex: "#303030", use: "тъмни повърхности, футър" },
  { name: "accent", hex: "#C2311E", use: "само разпродажба и намаление" },
  { name: "neutral", hex: "#E4E6E7", use: "фон зад продуктови снимки" },
  { name: "muted-text", hex: "#68737D", use: "зачертана цена, вторични етикети" },
  { name: "body-text", hex: "#212529", use: "цена в промоция, текущ текст" },
  { name: "background", hex: "#FFFFFF", use: "основа на страницата" },
  { name: "surface", hex: "#F7F7F7", use: "полета за въвеждане, панели" },
  { name: "success", hex: "#0F8000", use: "потвърждение за наличност" },
  { name: "border", hex: "#696969", use: "хеърлайни, разделители" },
];

const DEMO_COLORS = [
  { id: "black", name: "Черно", hex: "#101010" },
  { id: "grey", name: "Сиво", hex: "#8B8F93" },
  { id: "navy", name: "Тъмносиньо", hex: "#1F2A44" },
  { id: "sand", name: "Пясъчно", hex: "#C8B79A" },
  { id: "olive", name: "Маслинено", hex: "#4A5233" },
];

const DEMO_PRODUCTS = [
  {
    href: "/design-system",
    handle: "demo-jacket",
    name: "Мъжко яке с подплата 17497",
    price: 89.9,
    images: [
      { src: "https://picsum.photos/seed/redpoint-jacket-a/502/616", alt: "Мъжко яке с подплата, преден изглед" },
      { src: "https://picsum.photos/seed/redpoint-jacket-b/502/616" },
    ],
    colors: DEMO_COLORS.slice(0, 3),
  },
  {
    href: "/design-system",
    handle: "demo-denim",
    name: "Дънки права кройка 15786",
    price: 45.5,
    compareAtPrice: 65,
    images: [
      { src: "https://picsum.photos/seed/redpoint-denim-a/502/616", alt: "Дънки права кройка, преден изглед" },
      { src: "https://picsum.photos/seed/redpoint-denim-b/502/616" },
    ],
    colors: DEMO_COLORS,
  },
  {
    href: "/design-system",
    handle: "demo-shirt",
    name: "Риза с дълъг ръкав 16204",
    price: 32,
    images: [
      { src: "https://picsum.photos/seed/redpoint-shirt-a/502/616", alt: "Риза с дълъг ръкав, преден изглед" },
    ],
    colors: DEMO_COLORS.slice(1, 3),
  },
  {
    href: "/design-system",
    handle: "demo-tee",
    name: "Тениска с щампа 14930",
    price: 16,
    compareAtPrice: 24,
    images: [
      { src: "https://picsum.photos/seed/redpoint-tee-a/502/616", alt: "Тениска с щампа, преден изглед" },
      { src: "https://picsum.photos/seed/redpoint-tee-b/502/616" },
    ],
    colors: DEMO_COLORS.slice(0, 2),
  },
];

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-6 border-t border-border pt-8">
      <div className="flex flex-col gap-2">
        <h2>{title}</h2>
        {note && (
          <p className="max-w-[65ch] font-body text-body text-muted-text">{note}</p>
        )}
      </div>
      {children}
    </section>
  );
}

export default function DesignSystemPage() {
  return (
    <main className="mx-auto flex max-w-(--container-page) flex-col gap-12 px-4 py-16 md:px-8">
      <header className="flex flex-col gap-4">
        <h1 className="text-hero">Дизайн система</h1>
        <p className="max-w-[65ch] font-body text-body text-muted-text">
          Всеки примитив на едно място. Нула заоблени ъгли, нула сенки, червено
          само върху намаление.
        </p>
      </header>

      <Section
        title="Цветове"
        note="Десет токена, нищо извън тях. Палитрата на Tailwind е премахната, така че bg-slate-500 не се компилира."
      >
        <ul className="grid grid-cols-2 gap-6 md:grid-cols-5">
          {COLOR_TOKENS.map((token) => (
            <li key={token.name} className="flex flex-col gap-2">
              <span
                className="block h-20 w-full border border-border"
                style={{ backgroundColor: token.hex }}
              />
              <span className="font-body text-nav text-primary">{token.name}</span>
              <span className="font-body text-body text-muted-text">{token.hex}</span>
              <span className="font-body text-body text-muted-text">{token.use}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Типография"
        note="Заглавия кондензирани главни, текст Inter. Никъде моноспейс."
      >
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <span className="font-body text-body text-muted-text">
              text-hero, разширение за Фаза 3
            </span>
            <span className="font-headline text-hero uppercase">Разпродажба</span>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-body text-body text-muted-text">text-display, 32px</span>
            <span className="font-headline text-display uppercase">Нови постъпления</span>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-body text-body text-muted-text">text-subhead, 16px</span>
            <span className="font-body text-subhead text-border">Филтри</span>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-body text-body text-muted-text">text-body, 13px</span>
            <p className="max-w-[65ch] font-body text-body">
              Таблицата с размери е измерена от служители в магазина и важи за
              конкретния артикул, не за категорията.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-body text-body text-muted-text">text-nav, 14px</span>
            <span className="font-body text-nav">Мъже · Якета · Дънки · Обувки</span>
          </div>
        </div>
      </Section>

      <Section
        title="Бутони"
        note="Етикетите са с малки букви срещу главните заглавия. Това е нарочен ритъм."
      >
        <div className="flex flex-col gap-8">
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="solid">добави в количката</Button>
            <Button variant="outline">виж размерите</Button>
            <Button variant="solid" disabled>
              изчерпано
            </Button>
          </div>

          <div className="relative aspect-[21/9] w-full overflow-hidden bg-neutral">
            <Image
              src="https://picsum.photos/seed/redpoint-campaign/1600/686"
              alt=""
              fill
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 grid place-items-center">
              <Button variant="onImage">разгледай колекцията</Button>
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Баджове"
        note="Червеното носи тежест точно защото се появява само върху намаление."
      >
        <div className="flex flex-wrap items-center gap-4">
          <Badge variant="sale">-30%</Badge>
          <Badge variant="sale">разпродажба</Badge>
          <Badge variant="dark">ново</Badge>
          <Badge variant="dark">последен размер</Badge>
        </div>
      </Section>

      <Section
        title="Полета"
        note="Етикет отгоре, помощен текст и грешка отдолу. Грешката е монохромна, защото системата няма цвят за грешка."
      >
        <div className="grid gap-6 md:max-w-xl">
          <Input label="Имейл" type="email" placeholder="ivan@example.bg" />
          <Input
            label="Телефон"
            type="tel"
            helper="За връзка от куриера при доставка."
            placeholder="0888 123 456"
          />
          <Input
            label="Номер на поръчка"
            defaultValue="RP-1"
            error="Номерът на поръчка се състои от осем цифри."
          />
        </div>
      </Section>

      <Section
        title="Филтърна лента"
        note="Само текст и стрелка, разделени с хеърлайни. Не са бутони с кант."
      >
        <FilterBar
          filters={[
            { id: "category", label: "Категория" },
            { id: "size", label: "Размер", value: "L" },
            { id: "color", label: "Цвят" },
            { id: "price", label: "Цена" },
          ]}
        />
      </Section>

      <Section
        title="Продуктова карта"
        note="Четири колони на десктоп, две на мобилно. Задръж върху карта със две снимки, за да видиш прехода."
      >
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">
          {DEMO_PRODUCTS.map((product, index) => (
            <ProductCard key={product.name} {...product} priority={index < 2} />
          ))}
        </div>
      </Section>
    </main>
  );
}
