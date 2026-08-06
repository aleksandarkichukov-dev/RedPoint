import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { updateStoresWorkflow } from "@medusajs/medusa/core-flows";
import type { MedusaContainer } from "@medusajs/framework/types";

/**
 * The shop's own answers, kept in the store record.
 *
 * Not a JSON file, which is what the brief suggested and what the deployment
 * would eat. Production runs from `.medusa/server`, a build output copied to
 * the VPS — a file the admin wrote next to the running code is gone at the next
 * deploy, and the client would lose their answers without being told. The store
 * row already has a jsonb `metadata` column, it is backed up with everything
 * else, and it needs no migration.
 *
 * Small enough that the whole list is read and written at once. There is no
 * version where a shop has enough frequently asked questions for that to
 * matter, and a single write means two people editing cannot interleave into
 * something neither of them wrote.
 */

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  /** Extra words that should reach this answer, beyond those in the question. */
  keywords: string[];
}

const KEY = "faq";

function coerce(value: unknown): FaqEntry[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry): FaqEntry[] => {
    if (typeof entry !== "object" || entry === null) return [];
    const record = entry as Record<string, unknown>;
    const question = typeof record.question === "string" ? record.question.trim() : "";
    const answer = typeof record.answer === "string" ? record.answer.trim() : "";
    if (!question || !answer) return [];

    return [
      {
        id: typeof record.id === "string" && record.id ? record.id : question.slice(0, 40),
        question,
        answer,
        keywords: Array.isArray(record.keywords)
          ? record.keywords.filter((word): word is string => typeof word === "string")
          : [],
      },
    ];
  });
}

export async function readFaq(container: MedusaContainer): Promise<FaqEntry[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({ entity: "store", fields: ["id", "metadata"] });
  return coerce(data[0]?.metadata?.[KEY]);
}

export async function writeFaq(
  container: MedusaContainer,
  entries: unknown,
): Promise<FaqEntry[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({ entity: "store", fields: ["id", "metadata"] });
  const store = data[0];
  if (!store) throw new Error("no store to write to");

  const clean = coerce(entries);

  /* Spread the existing metadata rather than replacing it. The store record
     carries other things, and a save from this screen must not take them with
     it. */
  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: { metadata: { ...(store.metadata ?? {}), [KEY]: clean } },
    },
  });

  return clean;
}
