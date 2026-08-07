import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import type { ExecArgs } from "@medusajs/framework/types";
import { renderOrderEmail } from "../lib/order-email";
import { buildOrderEmailData } from "../lib/order-email-data";

/**
 * Sends one real order confirmation, to prove the shop can send email at all.
 *
 *   medusa exec ./src/scripts/check-order-email.ts
 *
 * Unlike the payment side, this can be proven from a laptop: mail goes out over
 * HTTPS and nobody has to call us back. So there is no reason for the first
 * real send to be a customer's.
 *
 * It goes through the notification module, the same way the subscriber does, so
 * what it proves is the whole chain — provider, key, sender address, template —
 * and not just that an API key is syntactically valid.
 *
 * Only ever to EMAIL_TEST_RECIPIENT. It reads a real order for its content,
 * and a real order carries a real customer's address; sending there to test
 * would mean a stranger gets a duplicate confirmation for something they
 * bought weeks ago.
 */
export default async function checkOrderEmail({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const notification = container.resolve(Modules.NOTIFICATION);

  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_FROM;
  const to = process.env.EMAIL_TEST_RECIPIENT;

  logger.info("=== Изпращане на имейл ===\n");

  /* What is actually configured, before anything is attempted. Half of the
     time this script is run, the answer is here and no send is needed. */
  if (!apiKey && !from) {
    logger.warn("SENDGRID_API_KEY и SENDGRID_FROM ги няма.");
    logger.warn("Магазинът пише имейлите в лога вместо да ги праща.\n");
    logger.warn("За да тръгнат:");
    logger.warn("  1. Акаунт в sendgrid.com и ключ (Settings > API Keys).");
    logger.warn("  2. Потвърден адрес подател (Settings > Sender Authentication).");
    logger.warn("  3. Двете в apps/backend/.env, плюс EMAIL_TEST_RECIPIENT — вашият адрес.");
    logger.warn("  4. Този скрипт пак.");
    return;
  }

  if (!apiKey || !from) {
    logger.error(`Само едното е зададено: ${apiKey ? "SENDGRID_API_KEY" : "SENDGRID_FROM"}.`);
    logger.error("Трябват и двете. Дотогава имейлите остават в лога.");
    return;
  }

  if (!to) {
    /* Refusing rather than guessing. The obvious fallback is SENDGRID_FROM,
       and a test that sends to itself passes on a sender address that no
       inbox will ever accept mail from. */
    logger.error("EMAIL_TEST_RECIPIENT липсва — не знам къде да пратя пробното писмо.");
    logger.error("Сложете вашия имейл в apps/backend/.env и пуснете пак.");
    return;
  }

  logger.info(`подател:   ${from}`);
  logger.info(`получател: ${to}`);

  /* A real order, because the point is the email a customer would get. A
     made-up one proves the template renders and nothing else — it was a real
     order that revealed the shop writing "Цвят 25" into the line a customer
     reads last, and totals coming back as undefined. */
  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "display_id"],
    pagination: { order: { created_at: "DESC" }, take: 1 },
  });

  const order = orders[0];
  if (!order) {
    logger.error("Няма нито една поръчка, от която да се направи писмото.");
    logger.error("Направете една тестова в магазина и пуснете пак.");
    return;
  }

  const built = await buildOrderEmailData(container, order.id);
  if (!built) {
    logger.error(`Поръчка ${order.display_id} не можа да се прочете.`);
    return;
  }

  const email = renderOrderEmail(built.data, "bg");
  logger.info(`писмо:     поръчка № ${built.data.displayId}, ${email.html.length} знака\n`);

  try {
    await notification.createNotifications({
      to,
      channel: "email",
      template: "order-placed",
      content: { subject: `[ТЕСТ] ${email.subject}`, html: email.html, text: email.text },
      data: { order_id: order.id, display_id: built.data.displayId },
    });

    logger.info("ИЗПРАТЕНО. SendGrid прие писмото.\n");
    logger.info(`Проверете пощата на ${to} — и папката за спам.`);
    /* Accepted is not delivered. SendGrid answer 202 and then decide, so an
       empty inbox after a pass is a deliverability question, not a code one,
       and the answer to it is on their Activity screen rather than here. */
    logger.info("Ако не пристигне, вижте Activity Feed в SendGrid — там пише защо.");
    logger.info("Най-честата причина е непотвърден адрес подател.");
  } catch (error) {
    const message = (error as Error).message ?? String(error);
    logger.error(`НЕ Е ИЗПРАТЕНО: ${message}\n`);

    /* SendGrid's own words, translated into what to do about them. Their
       errors are precise but arrive as a code and one English line, and the
       fix is nearly always one of three things. */
    if (/401|unauthorized|api key/i.test(message)) {
      logger.error("Ключът не се приема.");
      logger.error("Проверете дали е копиран целият, и дали е с права Mail Send.");
      logger.error("Ако съдържа '#', оградете го с кавички в .env — иначе се реже наум.");
    } else if (/from address|verified Sender|sender identity/i.test(message)) {
      logger.error(`Адресът ${from} не е потвърден в SendGrid.`);
      logger.error("Settings > Sender Authentication > Verify a Single Sender.");
    } else if (/template/i.test(message)) {
      /* Known suspect. The provider passes our `data` as SendGrid's
         dynamic template data, and SendGrid can reject that when there is no
         template id to go with it. Dropping `data` from the subscriber is the
         fix, and it costs only the order id on the notification record. */
      logger.error("SendGrid се оплаква от шаблон, а ние пращаме готов HTML.");
      logger.error("Причината е полето `data`, което провайдърът подава като");
      logger.error("dynamic template data. Махнете `data` от subscribers/order-placed.ts.");
    } else {
      logger.error("Непозната грешка. Целият текст е отгоре — той е от SendGrid, не от нас.");
    }
  }
}
