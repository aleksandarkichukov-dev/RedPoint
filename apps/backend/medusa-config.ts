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
    ...redisModules,
  ],
});

export { Modules };
