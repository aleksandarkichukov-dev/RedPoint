import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { ExecArgs } from "@medusajs/framework/types";
import { parsePhotoName } from "@redpoint/catalog";
import { photoPath } from "../modules/bulk/store-photos";

/**
 * A photograph's name cannot decide where the file lands.
 *
 *   medusa exec ./src/scripts/check-photo-paths.ts
 *
 * The article and the colour are read out of the name inside an uploaded zip
 * and interpolated into the stored path. `parsePhotoName` matches them as
 * `(.+)_(.+)_(\d+)`, which accepts `..` as happily as `синьо`, so without
 * something in between, a zip could write outside the uploads directory and
 * next to the running application.
 *
 * Whoever uploads is signed into the admin, so this is not the front door —
 * but a check is cheaper than trusting a regex to stay narrow, and this one
 * runs without a database or a zip file.
 */
export default async function checkPhotoPaths({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  let pass = 0;
  let fail = 0;
  const check = (name: string, ok: boolean, extra = "") => {
    if (ok) { pass += 1; logger.info(`PASS  ${name}`); }
    else { fail += 1; logger.error(`FAIL  ${name}${extra ? `  <- ${extra}` : ""}`); }
  };

  /* Every one of these parses as a valid photo name today. */
  const attacks = [
    ".._.._1.jpg",
    "..\\..\\evil_..\\..\\evil_1.jpg",
    "._._1.jpg",
    "a/b_c/d_1.jpg",
  ];

  for (const name of attacks) {
    const parsed = parsePhotoName(name);
    if (!parsed) {
      check(`"${name}" is refused outright`, true);
      continue;
    }

    const path = photoPath(parsed, name);
    const escapes = path.split("/").some((segment) => segment === "." || segment === "..");
    check(`"${name}" stays inside the uploads folder`, !escapes, path);
    check(`"${name}" keeps the products/ prefix`, path.startsWith("products/"), path);
  }

  /* And the ordinary case still works, Cyrillic and all — a guard that mangles
     real colour names would be found out a week later by an empty gallery. */
  const ordinary = parsePhotoName("17350_тъмносиньо_2.jpg");
  check("a real name parses", ordinary !== null);
  if (ordinary) {
    const path = photoPath(ordinary, "17350_тъмносиньо_2.jpg");
    check(
      "a real name is untouched",
      path === "products/17350/тъмносиньо/2.jpg",
      path,
    );
  }

  /* A dot inside a name is not a directory and must survive. */
  const dotted = parsePhotoName("17350_синьо.2_1.jpg");
  if (dotted) {
    const path = photoPath(dotted, "17350_синьо.2_1.jpg");
    check("a dot inside a colour survives", path.includes("синьо.2"), path);
  }

  logger.info(`\n${pass} passed, ${fail} failed`);
}
