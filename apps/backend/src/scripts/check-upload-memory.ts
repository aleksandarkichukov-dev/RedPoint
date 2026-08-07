import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { ExecArgs } from "@medusajs/framework/types";
import JSZip from "jszip";
import { readFile, readdir, stat, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readPhotoArchive } from "../modules/bulk/photos";

/**
 * What a photo upload costs in memory.
 *
 *   medusa exec ./src/scripts/check-upload-memory.ts
 *
 * The VPS is 2 GB and the stack already uses about 970 MB of it, so the
 * question "how much does an upload add" stopped being academic. It used to be
 * two full copies of the archive — multer held one in memory and JSZip built
 * another — under a 200 MB cap. That is a backend killed mid-upload with
 * customers on the site, and nothing in the code says so.
 *
 * This builds a real archive out of the shop's own photography, reads it the
 * way the route does, and reports the peak. A number nobody measured is a
 * number nobody can defend.
 */

/** Must match `middlewares.ts`. The first value here was 80 and this check
 *  refused the shop's own catalogue by 8.6 MB — JPEGs do not compress. */
const CAP_MB = 150;

export default async function checkUploadMemory({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  let pass = 0;
  let fail = 0;
  const check = (name: string, ok: boolean, extra = "") => {
    if (ok) { pass += 1; logger.info(`PASS  ${name}`); }
    else { fail += 1; logger.error(`FAIL  ${name}${extra ? `  <- ${extra}` : ""}`); }
  };

  const workDir = join(tmpdir(), "redpoint-upload-check");
  await mkdir(workDir, { recursive: true });

  try {
    /* Real photographs, because a zip of random bytes does not compress like a
       zip of JPEGs and would give a comfortable answer to the wrong question. */
    const source = join(process.cwd(), "../../seed/images");
    const zip = new JSZip();
    let added = 0;

    for (const article of await readdir(source)) {
      const articleDir = join(source, article);
      if (!(await stat(articleDir)).isDirectory()) continue;

      for (const colour of await readdir(articleDir)) {
        const colourDir = join(articleDir, colour);
        if (!(await stat(colourDir)).isDirectory()) continue;

        for (const file of await readdir(colourDir)) {
          zip.file(`${article}_${colour}_${added % 9}.jpg`, await readFile(join(colourDir, file)));
          added += 1;
        }
      }
    }

    check("има истински снимки, с които да се пробва", added > 0, `${added}`);
    if (added === 0) return;

    const archivePath = join(workDir, "photos.zip");
    await writeFile(archivePath, await zip.generateAsync({ type: "nodebuffer" }));

    const sizeMb = (await stat(archivePath)).size / 1024 / 1024;
    logger.info(`\nАрхив: ${added} снимки, ${sizeMb.toFixed(1)} MB\n`);

    check(
      "истинският каталог се събира под тавана",
      sizeMb < CAP_MB,
      `${sizeMb.toFixed(1)} MB срещу ${CAP_MB} MB`,
    );

    /* Now the read itself, measured the way the route performs it: the file
       comes off disk rather than out of a request buffer. */
    /* Measured as resident set, not heap. A Buffer is allocated outside the JS
       heap, so `heapUsed` is blind to precisely the thing being measured here —
       the first version of this check reported that reading an 88 MB archive
       used minus four megabytes, which is the kind of reassuring answer worth
       distrusting. */
    global.gc?.();
    const before = process.memoryUsage().rss;

    const buffer = await readFile(archivePath);
    const photos = await readPhotoArchive(buffer);
    for (const photo of photos) await photo.read();

    const peak = (process.memoryUsage().rss - before) / 1024 / 1024;

    check("архивът се прочита докрай", photos.length === added, `${photos.length} от ${added}`);

    logger.info(`\nПрочитането зае ${peak.toFixed(0)} MB.`);
    logger.info("Стекът в покой е ~970 MB от 2048 MB, значи остават ~1000 MB.");

    /* One copy of the archive, give or take. Two copies is what this change
       removed, so the threshold is set where a return to two would fail:
       anything much above the archive's own size means somebody has put the
       upload back on the heap alongside JSZip. */
    check(
      "прочитането струва едно копие, не две",
      peak < sizeMb * 1.6,
      `${peak.toFixed(0)} MB за архив от ${sizeMb.toFixed(1)} MB`,
    );

    logger.info(`\n${pass} passed, ${fail} failed`);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
