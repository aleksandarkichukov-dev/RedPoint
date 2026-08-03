import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { CONFIG } from "./config.js";
import { readCachedPage, writeCachedPage } from "./cache.js";

/**
 * One browser, one context, one page, strictly serial.
 *
 * Parallelism is the whole reason a crawl gets blocked, so there is no worker
 * pool here on purpose. Plain `fetch` is not an option either: the old site is
 * behind Cloudflare and hands a challenge to anything without a real engine.
 */
export class Session {
  private browser!: Browser;
  private context!: BrowserContext;
  private page!: Page;
  private lastNavigationAt = 0;
  public requestCount = 0;
  public cacheHits = 0;

  async start(): Promise<void> {
    this.browser = await chromium.launch({ headless: true });
    this.context = await this.browser.newContext({
      userAgent: CONFIG.userAgent,
      locale: "bg-BG",
      viewport: { width: 1440, height: 900 },
    });
    this.context.setDefaultNavigationTimeout(CONFIG.navigationTimeoutMs);

    // Images, fonts and stylesheets are dead weight for parsing, and skipping
    // them is a large share of the bandwidth this crawl would otherwise cost
    // the old server. Product photography is downloaded separately, directly.
    await this.context.route("**/*", (route) => {
      const type = route.request().resourceType();
      if (type === "image" || type === "font" || type === "media" || type === "stylesheet") {
        return route.abort();
      }
      return route.continue();
    });

    this.page = await this.context.newPage();
  }

  async close(): Promise<void> {
    await this.context?.close();
    await this.browser?.close();
  }

  /** The live page object, for interactions that need more than static HTML
   *  (clicking through colour swatches to read their per-colour size lists). */
  get livePage(): Page {
    return this.page;
  }

  private async throttle(): Promise<void> {
    const spacing =
      CONFIG.throttleMinMs +
      Math.random() * (CONFIG.throttleMaxMs - CONFIG.throttleMinMs);
    const elapsed = Date.now() - this.lastNavigationAt;
    if (elapsed < spacing) {
      await new Promise((resolve) => setTimeout(resolve, spacing - elapsed));
    }
  }

  /**
   * Navigates and returns the rendered HTML, serving from the on-disk cache
   * when possible. `interact` runs against the live page before the HTML is
   * captured; it is skipped on a cache hit, so callers that need interaction
   * must pass `force: true`.
   */
  async fetchPage(
    url: string,
    options: { force?: boolean } = {},
  ): Promise<{ html: string; fromCache: boolean }> {
    if (!options.force) {
      const cached = await readCachedPage(url);
      if (cached) {
        this.cacheHits += 1;
        return { html: cached, fromCache: true };
      }
    }

    let lastError: unknown;
    for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt += 1) {
      try {
        await this.throttle();
        this.lastNavigationAt = Date.now();
        this.requestCount += 1;

        const response = await this.page.goto(url, { waitUntil: "domcontentloaded" });
        const status = response?.status() ?? 0;

        // 403/429/503 from Cloudflare mean slow down, not retry immediately.
        if (status === 403 || status === 429 || status === 503) {
          throw new Error(`blocked with HTTP ${status}`);
        }
        if (status >= 400) {
          throw new Error(`HTTP ${status}`);
        }

        const html = await this.page.content();
        await writeCachedPage(url, html);
        return { html, fromCache: false };
      } catch (error) {
        lastError = error;
        if (attempt < CONFIG.maxRetries) {
          console.warn(
            `  retry ${attempt}/${CONFIG.maxRetries - 1} for ${url}: ${String(error)}`,
          );
          await new Promise((resolve) => setTimeout(resolve, CONFIG.retryCooldownMs));
        }
      }
    }
    throw new Error(`failed after ${CONFIG.maxRetries} attempts: ${url}: ${String(lastError)}`);
  }

  /** Navigates without caching, leaving the live page ready to interact with. */
  async openLive(url: string): Promise<void> {
    await this.throttle();
    this.lastNavigationAt = Date.now();
    this.requestCount += 1;
    await this.page.goto(url, { waitUntil: "domcontentloaded" });
  }
}
