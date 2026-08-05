"use client";

import { ChatCircle, PaperPlaneRight, X } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ask, type ChatAnswer } from "@/lib/chat/answer";
import { cn } from "@/lib/cn";
import { formatEur } from "@/lib/price";

/**
 * The help panel, bottom right.
 *
 * Square, flat, monochrome, no shadow — a panel in this system is a block of
 * colour with a hard edge, the same as everything else. The one concession to
 * its floating position is the border, which is what separates it from the page
 * where a shadow would normally do the work.
 *
 * Every answer is built on the server from the catalogue. Nothing here calls a
 * model, so a reply arrives in the time one query takes and says the same thing
 * every time.
 */

interface Turn {
  from: "shopper" | "shop";
  text: string;
  answer?: ChatAnswer;
}

const GREETING: Turn = {
  from: "shop",
  text: "Здравейте. Питайте за дреха по име или по артикулен номер, или за доставка, връщане и магазините.",
  answer: {
    text: "",
    suggestions: ["какво е доставката", "как връщам дреха", "къде са магазините"],
  },
};

export function ChatPanel() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([GREETING]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);

  const log = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const titleId = useId();

  /* Escape closes it, and that is the whole of the keyboard handling. No focus
     trap and no scroll lock: this is a helper the shopper keeps open while
     reading the page behind it, not a modal, and trapping them inside it would
     be a worse lie than the one `aria-modal="false"` already tells. */
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  /* Newest turn into view, and the cursor back in the field. Someone who has
     just read an answer is about to type the next question. */
  useEffect(() => {
    if (!open) return;
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: "smooth" });
    input.current?.focus();
  }, [open, turns]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || pending) return;

    setTurns((current) => [...current, { from: "shopper", text: question }]);
    setDraft("");
    setPending(true);

    try {
      const answer = await ask(question);
      setTurns((current) => [...current, { from: "shop", text: answer.text, answer }]);
    } catch {
      setTurns((current) => [
        ...current,
        {
          from: "shop",
          text: "Нещо се обърка. Опитайте пак или се обадете на +359 89 247 5402.",
        },
      ]);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      {/* Square, like every other control here. Sits above the footer and out
          of the way of the cart, which is the one thing nobody should have to
          hunt for. */}
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={open ? "Затвори помощта" : "Питай ни"}
        className={cn(
          "fixed right-4 bottom-4 z-50 grid size-12 place-items-center border md:right-8 md:bottom-8",
          "transition-transform duration-(--duration-fast) active:scale-[0.97]",
          open
            ? "border-primary bg-background text-primary"
            : "border-primary bg-primary text-background",
        )}
      >
        {open ? <X size={20} aria-hidden /> : <ChatCircle size={22} aria-hidden />}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          className={cn(
            "fixed right-4 bottom-20 z-50 flex w-[calc(100vw-2rem)] max-w-[380px] flex-col",
            "max-h-[min(32rem,calc(100dvh-8rem))] border border-primary bg-background",
            "md:right-8 md:bottom-24",
            "rp-panel-from-corner",
          )}
        >
          <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
            <h2 id={titleId} className="font-headline text-subhead text-primary uppercase">
              Питай ни
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Затвори"
              className="grid size-8 place-items-center text-primary"
            >
              <X size={18} aria-hidden />
            </button>
          </header>

          <div
            ref={log}
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4"
            aria-live="polite"
          >
            {turns.map((turn, index) => (
              <Bubble key={index} turn={turn} onAsk={send} />
            ))}
            {pending && (
              <p className="font-body text-body text-muted-text">пиша…</p>
            )}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send(draft);
            }}
            className="flex items-center gap-2 border-t border-border p-2"
          >
            <input
              ref={input}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="дънки, 17350, доставка…"
              aria-label="Вашият въпрос"
              className="min-w-0 flex-1 bg-surface px-3 py-2 font-body text-input text-body-text outline-none"
            />
            <button
              type="submit"
              disabled={pending || !draft.trim()}
              aria-label="Изпрати"
              className="grid size-10 shrink-0 place-items-center bg-primary text-background disabled:opacity-40"
            >
              <PaperPlaneRight size={18} aria-hidden />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function Bubble({ turn, onAsk }: { turn: Turn; onAsk: (text: string) => void }) {
  /* The shopper's own words sit in a filled block, the shop's on the page.
     Two flat weights rather than two colours — the accent is spent on sale
     signage and nothing else. */
  if (turn.from === "shopper") {
    return (
      <p className="ml-auto max-w-[85%] bg-neutral px-3 py-2 font-body text-body text-primary">
        {turn.text}
      </p>
    );
  }

  const answer = turn.answer;

  return (
    <div className="flex flex-col gap-3">
      {turn.text && (
        <p className="max-w-[95%] font-body text-body text-body-text">{turn.text}</p>
      )}

      {answer?.products?.map((product) => (
        <Link
          key={product.href}
          href={product.href}
          className="flex items-start gap-3 border border-border p-2 hover:border-primary"
        >
          <span className="relative block size-16 shrink-0 overflow-hidden bg-neutral">
            {product.image && (
              <Image src={product.image} alt="" fill sizes="64px" className="object-cover" />
            )}
          </span>
          <span className="flex min-w-0 flex-col gap-1">
            <span className="line-clamp-2 font-body text-body text-primary uppercase">
              {product.title}
            </span>
            <span className="font-body text-price text-body-text">
              {formatEur(product.price)}
            </span>
            <span className="font-body text-body text-muted-text">
              {product.soldOut ? "изчерпан" : `размери: ${product.sizes.join(", ")}`}
            </span>
          </span>
        </Link>
      ))}

      {answer?.phones?.map((entry) => (
        <a
          key={entry.phone}
          href={`tel:${entry.phone.replace(/\s/g, "")}`}
          className="flex flex-col border border-border p-2 hover:border-primary"
        >
          <span className="font-body text-body text-muted-text">{entry.name}</span>
          <span className="font-body text-nav text-primary">{entry.phone}</span>
        </a>
      ))}

      {answer?.links?.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="w-fit font-body text-control text-primary underline"
        >
          {link.label}
        </Link>
      ))}

      {answer?.suggestions && answer.suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {answer.suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onAsk(suggestion)}
              className="border border-border px-3 py-1.5 font-body text-control text-primary hover:border-primary"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
