import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { ExecArgs } from "@medusajs/framework/types";
import { readFaq, writeFaq } from "../modules/faq/store";

/**
 * Round-trips the FAQ through the store record.
 *
 * Worth having because the storage is the interesting part: it lives in a jsonb
 * column shared with everything else the store carries, and a save from that
 * screen must not take the rest with it.
 *
 *   medusa exec ./src/scripts/check-faq.ts
 */
export default async function checkFaq({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  let pass = 0;
  let fail = 0;
  const check = (name: string, ok: boolean, extra = "") => {
    if (ok) {
      pass += 1;
      logger.info(`PASS  ${name}`);
    } else {
      fail += 1;
      logger.error(`FAIL  ${name}${extra ? `  <- ${extra}` : ""}`);
    }
  };

  const before = await readFaq(container);

  /* Something else in the store's metadata, to prove a save does not eat it. */
  const { data: stores } = await query.graph({ entity: "store", fields: ["id", "metadata"] });
  const otherKeys = Object.keys(stores[0]?.metadata ?? {}).filter((key) => key !== "faq");

  await writeFaq(container, [
    { id: "q1", question: "Мога ли да заменя размер?", answer: "Да, до 14 дни.", keywords: ["смяна", "малко ми е"] },
    { id: "q2", question: "Работите ли в неделя?", answer: "Да, и трите магазина.", keywords: [] },
    { question: "", answer: "празен въпрос", keywords: [] },
    { question: "без отговор", answer: "", keywords: [] },
    "не е обект",
  ]);

  const saved = await readFaq(container);
  check("two valid entries survive", saved.length === 2, String(saved.length));
  check("the empty question is dropped", !saved.some((e) => !e.question));
  check("the answerless entry is dropped", !saved.some((e) => !e.answer));
  check("keywords round-trip", saved[0]?.keywords.join(",") === "смяна,малко ми е", saved[0]?.keywords.join(","));
  check("an entry with no id gets one", saved.every((e) => Boolean(e.id)));

  const { data: after } = await query.graph({ entity: "store", fields: ["id", "metadata"] });
  const keptKeys = Object.keys(after[0]?.metadata ?? {}).filter((key) => key !== "faq");
  check(
    "the rest of the store metadata is untouched",
    otherKeys.every((key) => keptKeys.includes(key)),
    `${otherKeys.join(",")} → ${keptKeys.join(",")}`,
  );

  /* Put back whatever was there, so running this on a live shop is harmless. */
  await writeFaq(container, before);
  const restored = await readFaq(container);
  check("the original list is restored", restored.length === before.length);

  logger.info(`\n${pass} passed, ${fail} failed`);
}
