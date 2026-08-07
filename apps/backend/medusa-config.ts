import { defineConfig, loadEnv, Modules } from "@medusajs/framework/utils";

loadEnv(process.env.NODE_ENV || "development", process.cwd());

const REDIS_URL = process.env.REDIS_URL;
const BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000";

/**
 * Redis-backed modules are only registered when REDIS_URL is set.
 *
 * Medusa falls back to in-memory implementations otherwise, which is fine for
 * a laptop but loses every queued job on restart. On the VPS, Redis is what
 * lets the worker survive as its own long-running process, which is the whole
 * reason the brief insists on a managed VPS rather than shared hosting.
 */
const redisModules = REDIS_URL
  ? [
      {
        resolve: "@medusajs/medusa/cache-redis",
        options: { redisUrl: REDIS_URL },
      },
      {
        resolve: "@medusajs/medusa/event-bus-redis",
        options: { redisUrl: REDIS_URL },
      },
      {
        /* Without this the locking module falls back to in-memory, which only
           holds within a single process. On the VPS the API and the worker are
           separate processes, so an in-memory lock would let both run the same
           job at once. Locking takes providers, like the file module, rather
           than a bare resolve. */
        resolve: "@medusajs/medusa/locking",
        options: {
          providers: [
            {
              resolve: "@medusajs/medusa/locking-redis",
              id: "locking-redis",
              is_default: true,
              options: { redisUrl: REDIS_URL },
            },
          ],
        },
      },
      {
        resolve: "@medusajs/medusa/workflow-engine-redis",
        /* This module warns that `redis: { url }` is deprecated in favour of
           `redisUrl`, but in 2.18 its loader still destructures `redis.url`
           and throws "Cannot destructure property 'url'" if you follow the
           advice. Keep the old shape until the loader catches up; the warning
           is noise, not a bug. */
        options: { redis: { url: REDIS_URL } },
      },
    ]
  : [];

/**
 * Who actually sends the email.
 *
 * SendGrid needs two things and refuses on either: a key, and a sender address
 * it has been shown belongs to us. Both are the shop's to supply, so until
 * they exist this stays on the local provider, which writes the message to the
 * log — visible, and impossible to mistake for delivery.
 *
 * The address is required alongside the key rather than defaulted, because a
 * plausible-looking default is the one thing worse than no address at all:
 * SendGrid rejects an unverified sender, and the rejection arrives in a log
 * nobody is reading while the shopper sees "изпратихме потвърждение".
 */
function emailProvider() {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_FROM;

  if (apiKey && from) {
    return {
      resolve: "@medusajs/medusa/notification-sendgrid",
      id: "sendgrid",
      options: { channels: ["email"], api_key: apiKey, from },
    };
  }

  if (apiKey || from) {
    /* Half-configured is a mistake, not a state. Saying so at boot costs a
       line in the log; finding out from a customer who never got their
       confirmation costs an order. */
    console.warn(
      "[notification] SENDGRID_API_KEY and SENDGRID_FROM must both be set. " +
        "Email stays in the log until they are.",
    );
  }

  return {
    resolve: "@medusajs/medusa/notification-local",
    id: "local",
    options: { name: "Local Notification Provider", channels: ["email"] },
  };
}

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: REDIS_URL,
    workerMode:
      (process.env.MEDUSA_WORKER_MODE as "shared" | "worker" | "server") ?? "shared",
    http: {
      storeCors: process.env.STORE_CORS || "http://localhost:3000",
      adminCors: process.env.ADMIN_CORS || "http://localhost:9000",
      authCors: process.env.AUTH_CORS || "http://localhost:3000,http://localhost:9000",
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },
  },
  admin: {
    disable: process.env.DISABLE_MEDUSA_ADMIN === "true",
  },
  modules: [
    {
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          {
            // Local disk for now. Phase 9 swaps this for an S3-compatible
            // provider if the VPS gets object storage; nothing else changes.
            resolve: "@medusajs/medusa/file-local",
            id: "local",
            options: {
              upload_dir: "static",
              backend_url: `${BACKEND_URL}/static`,
            },
          },
        ],
      },
    },
    {
      /* Notifications.

         SendGrid the moment a key exists, the log otherwise. The switch is on
         the key rather than on a separate flag because a half-configured mail
         setup is the failure nobody sees: the shop shows "изпратихме
         потвърждение", the log says the email was queued, and nothing arrives.
         With no key there is no ambiguity — it is the local provider and it
         says so at boot.

         Neither the subscriber nor the templates change between the two. The
         SendGrid provider uses `content.subject` and `content.html` whenever a
         notification carries content, and only falls back to a SendGrid-hosted
         template when it does not. Ours always carries content. */
      resolve: "@medusajs/medusa/notification",
      options: {
        providers: [emailProvider()],
      },
    },
    ...redisModules,
  ],
});

export { Modules };
