import fs from "node:fs/promises";
import path from "node:path";
import { BASE_URL, CONFIG, PATHS, REPO_ROOT } from "./config.js";

/**
 * Downloads product photography to `seed/images/{sku}/{colour}/{n}.jpg`.
 *
 * Already-present files are skipped, so this is resumable in the same way the
 * page crawl is. Images are fetched directly rather than through Playwright:
 * they are static assets, and pulling them through a browser page would be
 * both slower and pointless.
 */

let lastDownloadAt = 0;

async function throttle(): Promise<void> {
  const elapsed = Date.now() - lastDownloadAt;
  if (elapsed < CONFIG.imageThrottleMs) {
    await new Promise((resolve) => setTimeout(resolve, CONFIG.imageThrottleMs - elapsed));
  }
  lastDownloadAt = Date.now();
}

function safeSegment(value: string): string {
  return value.replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "") || "unknown";
}

async function exists(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.size > 0;
  } catch {
    return false;
  }
}

async function download(url: string, destination: string): Promise<boolean> {
  await throttle();
  const response = await fetch(url, {
    headers: { "User-Agent": CONFIG.userAgent, Referer: BASE_URL },
    signal: AbortSignal.timeout(CONFIG.imageTimeoutMs),
  });
  if (!response.ok) return false;

  const buffer = Buffer.from(await response.arrayBuffer());
  // A Cloudflare challenge page is HTML, not an image, and would otherwise be
  // written to disk as a valid-looking .jpg.
  if (buffer.length < 1024) return false;

  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, buffer);
  return true;
}

export interface DownloadReport {
  downloaded: number;
  skipped: number;
  failed: { url: string; reason: string }[];
}

/**
 * Fetches one colour's images and returns their repo-relative paths.
 *
 * `toOriginalResolution` upgrades every source URL to the `_2000h` variant
 * before it gets here, but that variant does not exist for every image on the
 * old site. When it 404s, the original URL is used as a fallback rather than
 * losing the photo.
 */
export async function downloadColorImages(
  sku: string,
  colorName: string,
  sources: string[],
  report: DownloadReport,
): Promise<string[]> {
  const directory = path.join(PATHS.images, safeSegment(sku), safeSegment(colorName));
  const localPaths: string[] = [];

  for (const [index, source] of sources.entries()) {
    const extension = path.extname(new URL(source).pathname) || ".jpg";
    const absolute = path.join(directory, `${index + 1}${extension}`);
    const relative = path.relative(REPO_ROOT, absolute).split(path.sep).join("/");

    if (await exists(absolute)) {
      report.skipped += 1;
      localPaths.push(relative);
      continue;
    }

    try {
      let ok = await download(source, absolute);

      if (!ok) {
        const fallback = source.replace(
          new RegExp(`_${CONFIG.imageResolution}\\.`),
          "_502x616.",
        );
        ok = fallback !== source && (await download(fallback, absolute));
      }

      if (ok) {
        report.downloaded += 1;
        localPaths.push(relative);
      } else {
        report.failed.push({ url: source, reason: "not available at any resolution" });
      }
    } catch (error) {
      report.failed.push({ url: source, reason: String(error) });
    }
  }

  return localPaths;
}
