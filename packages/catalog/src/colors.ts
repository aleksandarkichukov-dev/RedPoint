/**
 * Turning a sampled RGB value into a Bulgarian colour name.
 *
 * The old site records no colour anywhere — only a numeric id per product, so
 * a garment arrives labelled "Цвят 25" and nothing more. Sampling the product
 * photography is the only source of the actual colour that exists.
 *
 * Measured across all 476 photographs, the numeric ids are NOT a reliable
 * global palette: id 32 lands on colours 83 RGB units apart across products,
 * so it means different things on different garments. Names are therefore
 * derived per product-and-colour from that combination's own photograph, never
 * from the id.
 *
 * Kept dependency-free and pure so the naming rule is one testable function
 * shared by the seed today and the bulk import module in Phase 7.
 */

/** Hue in degrees, saturation and lightness in 0..1. */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;

  return [h * 60, s, l];
}

/**
 * The colour name a shopper would use for this RGB value.
 *
 * Base colours only — one word each, no shades. A filter that offers "светло
 * синьо" and "тъмно синьо" as separate entries splits one thing a shopper is
 * looking for across two rows, and the shade is already visible in the
 * photograph. The sampled hex is stored alongside, so nothing is lost.
 *
 * Saturation picks the vocabulary before hue picks the word. Garment
 * photography is full of muted colours between s 0.15 and 0.30 — a washed
 * brown, a blue-grey — and naming those from hue alone called a brown bracelet
 * "червено" and a grey polo "тюркоазено". Each band below was checked against
 * the actual photographs, not just against the numbers.
 */
export function colorNameFromRgb(r: number, g: number, b: number): string {
  const [h, s, l] = rgbToHsl(r, g, b);

  if (l < 0.16) return "черно";

  const warm = h < 50 || h >= 345;
  const blue = h >= 195 && h < 255;

  if (s < 0.15) {
    /* Navy photographs almost fully desaturated. A blue cast this consistent
       and this dark is a navy garment, not a charcoal one. */
    if (blue && s >= 0.08 && l < 0.32) return "синьо";
    if (l > 0.86) return "бяло";
    return "сиво";
  }

  if (s < 0.3) {
    if (warm) return l < 0.45 ? "кафяво" : "бежово";
    if (h < 195) return "зелено";
    if (blue) return "синьо";
    return l > 0.65 ? "розово" : "лилаво";
  }

  if (h < 15 || h >= 345) return l > 0.68 ? "розово" : "червено";
  if (h < 45) {
    // A warm tone only earns "оранжево" if it is genuinely vivid; leather and
    // washed cotton sit right on this line and are brown, not orange.
    if (s < 0.45 && l < 0.55) return "кафяво";
    if (l < 0.42) return "кафяво";
    if (l > 0.62 && s < 0.45) return "бежово";
    return "оранжево";
  }
  if (h < 70) return l < 0.42 ? "зелено" : "жълто";
  if (h < 195) return "зелено";
  if (h < 255) return "синьо";
  if (h < 290) return "лилаво";
  return l > 0.66 ? "розово" : "лилаво";
}

/** Colour adjectives as the shop writes them in its product names. */
const TITLE_COLORS: [RegExp, string][] = [
  [/син(ь|и|е|я)|тъмносин|светлосин/i, "синьо"],
  [/черн|черен/i, "черно"],
  [/бял|бяла|бяло|бели/i, "бяло"],
  [/беж/i, "бежово"],
  [/сив/i, "сиво"],
  [/кафяв/i, "кафяво"],
  [/червен|бордо/i, "червено"],
  [/маслинен|каки|зелен/i, "зелено"],
  [/жълт/i, "жълто"],
  [/оранжев/i, "оранжево"],
  [/розов/i, "розово"],
  [/лилав|виолет/i, "лилаво"],
  [/тюркоаз/i, "синьо"],
];

/**
 * The colour the shop itself named in the product title, if it named one.
 *
 * This outranks anything sampled from a photograph: "Бежов суитшърт" is the
 * shop telling us the colour, while a sampler looking at that same washed-out
 * studio shot returns a neutral grey. Measured over the 27 single-colour
 * products whose title carries a colour word, the sampler agreed with the shop
 * only 67% of the time, and every disagreement was the sampler's.
 *
 * A colour word only counts when it leads the name or is spelled out as the
 * garment's colour. Deeper in the sentence it describes a detail — "с бели
 * пръски", "с бял декоративен кант" — and taking it turns navy jeans white.
 */
export function colorNameFromTitle(title: string): string | null {
  const head = title.split(/\s+/).slice(0, 2).join(" ");
  for (const [pattern, name] of TITLE_COLORS) {
    if (pattern.test(head)) return name;
  }

  /* `(^|\s)` rather than `\b`: JavaScript's word boundary is defined over
     ASCII \w, so it never fires between a space and a Cyrillic letter. With
     `\bв\s+` this whole branch silently matched nothing, and "колан в цвят
     бордо" came out named from its photograph as grey. */
  const spelledOut = title.match(/(?:^|\s)в\s+(?:цвят\s+)?[^,.]{3,20}/i);
  if (spelledOut) {
    for (const [pattern, name] of TITLE_COLORS) {
      if (pattern.test(spelledOut[0])) return name;
    }
  }

  return null;
}

/** `[18, 52, 86]` to `#123456`, for storing a swatch alongside the name. */
export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
