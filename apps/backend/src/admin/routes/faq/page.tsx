import { defineRouteConfig } from "@medusajs/admin-sdk";
import { ChatBubble, Plus, Trash } from "@medusajs/icons";
import { Button, Container, Input, Text, Textarea, toast } from "@medusajs/ui";
import { useEffect, useState } from "react";

/**
 * What the chat answers when nobody is at the shop.
 *
 * The screen is a list of question-and-answer pairs, saved together. No
 * per-row save button: the shop edits three lines, presses one button, and
 * what they see on the screen is what the shop front will say. A row-level
 * save invites half-saved lists and a "did that go through?" phone call.
 *
 * Everything is in Bulgarian, and the help text says what each field is FOR
 * rather than what it is called — the person filling this in has never seen a
 * keyword field before.
 */

interface Entry {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
}

const blank = (): Entry => ({
  id: `q${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
  question: "",
  answer: "",
  keywords: [],
});

const FaqPage = () => {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/admin/faq", { credentials: "include" })
      .then((response) => response.json())
      .then((data) => setEntries(data.faq ?? []))
      .catch(() => {
        toast.error("Въпросите не се заредиха.");
        setEntries([]);
      });
  }, []);

  const update = (id: string, patch: Partial<Entry>) => {
    setEntries((current) =>
      (current ?? []).map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );
  };

  const save = async () => {
    const filled = (entries ?? []).filter(
      (entry) => entry.question.trim() && entry.answer.trim(),
    );

    setBusy(true);
    try {
      const response = await fetch("/admin/faq", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ faq: filled }),
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message ?? "Нещо се обърка.");
        return;
      }

      setEntries(data.faq);
      toast.success(
        filled.length === 0
          ? "Списъкът е празен. Чатът ще отговаря със стандартните отговори."
          : `Записани са ${filled.length} въпроса.`,
      );
    } catch {
      toast.error("Връзката със сървъра прекъсна.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-col gap-2 px-6 py-4">
        <h1 className="txt-large-plus text-ui-fg-base">Чести въпроси</h1>
        <Text size="small" className="text-ui-fg-subtle">
          Тези отговори излизат в чата на сайта. Първите три се показват и като
          бутони, преди клиентът да е написал каквото и да е.
        </Text>
      </div>

      <div className="flex flex-col gap-6 px-6 py-4">
        {entries === null && <Text size="small">Зареждаме…</Text>}

        {entries?.length === 0 && (
          <Text size="small" className="text-ui-fg-subtle">
            Няма записани въпроси. Чатът отговаря със стандартните отговори за
            доставка, връщане и магазините, докато не добавите свои.
          </Text>
        )}

        {entries?.map((entry, index) => (
          <div key={entry.id} className="flex flex-col gap-3 border-b border-ui-border-base pb-6">
            <div className="flex items-center justify-between gap-4">
              <Text weight="plus">Въпрос {index + 1}</Text>
              <Button
                variant="transparent"
                onClick={() =>
                  setEntries((current) => (current ?? []).filter((item) => item.id !== entry.id))
                }
              >
                <Trash />
                Изтрий
              </Button>
            </div>

            <div className="flex flex-col gap-1">
              <Text size="small" className="text-ui-fg-subtle">
                Въпросът, както клиентът би го задал
              </Text>
              <Input
                value={entry.question}
                placeholder="Мога ли да заменя размер?"
                onChange={(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => update(entry.id, { question: event.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1">
              <Text size="small" className="text-ui-fg-subtle">
                Отговорът
              </Text>
              <Textarea
                rows={3}
                value={entry.answer}
                placeholder="Да, до 14 дни, в който и да е от трите магазина."
                onChange={(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => update(entry.id, { answer: event.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1">
              <Text size="small" className="text-ui-fg-subtle">
                Други думи, с които някой би попитал същото — разделени със
                запетая. Не повтаряйте думите от въпроса, те се търсят сами.
              </Text>
              <Input
                value={entry.keywords.join(", ")}
                placeholder="смяна, друг размер, малко ми е"
                onChange={(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                  update(entry.id, {
                    keywords: event.target.value
                      .split(",")
                      .map((word: string) => word.trim())
                      .filter(Boolean),
                  })
                }
              />
            </div>
          </div>
        ))}

        <div className="flex items-center justify-between gap-4">
          <Button
            variant="secondary"
            onClick={() => setEntries((current) => [...(current ?? []), blank()])}
          >
            <Plus />
            Добави въпрос
          </Button>
          <Button variant="primary" onClick={save} isLoading={busy} disabled={entries === null}>
            Запиши
          </Button>
        </div>
      </div>
    </Container>
  );
};

export const config = defineRouteConfig({
  label: "Чести въпроси",
  icon: ChatBubble,
});

export default FaqPage;
