/**
 * Turning what someone typed into something the catalogue can be searched by.
 *
 * The brief calls this the most underestimated part of the chatbot, and it is
 * right. Bulgarians type the same word four ways — `дънки`, `denki`, `danki`,
 * `dunki` — and an exact match answers one of them.
 *
 * The pipeline is three steps, each of which can be wrong on its own without
 * breaking the next:
 *
 *   1. normalise   lowercase, strip accents, collapse whitespace
 *   2. cyrillicise Latin to Cyrillic, longest digraphs first
 *   3. compare     trigram overlap, because step 2 cannot be exact
 *
 * Step 3 is what carries the vowels. `ъ` has no Latin letter of its own, so
 * people substitute whatever is nearest to hand and `denki`, `danki` and
 * `dunki` all arrive slightly wrong. Trigram overlap does not care: `денки` and
 * `дънки` share four of six trigrams, which is far above anything unrelated.
 *
 * No Medusa and no HTTP in here, so it is testable with plain node.
 */

/** Lowercase, unaccented, single-spaced. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    /* NFD splits an accented letter into letter plus combining mark, and the
       range below removes the marks. Bulgarian does not use accents, but people
       paste from places that do, and `ѝ` (which Bulgarian does use) survives
       because it is the word "her", not a typo for `и`. */
    .normalize("NFD")
    .replace(/[̀-̈̊-ͯ]/g, "")
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Latin to Cyrillic, longest sequence first.
 *
 * Order is the whole trick: `sht` has to be tried before `sh`, and `sh` before
 * `s`, or `щ` comes out as `сх` and every match after it is noise.
 *
 * Deliberately not reversible. `y` becomes `й` and `a` stays `а`, so `ъ` is
 * never produced — no Latin letter stands for it and guessing would be worse
 * than leaving the trigram comparison to absorb it.
 */
const TRANSLITERATIONS: [string, string][] = [
  ["sht", "щ"],
  ["zh", "ж"],
  ["ch", "ч"],
  ["sh", "ш"],
  ["ts", "ц"],
  ["yu", "ю"],
  ["ju", "ю"],
  ["ya", "я"],
  ["ja", "я"],
  ["yo", "ьо"],
  ["a", "а"],
  ["b", "б"],
  ["v", "в"],
  ["w", "в"],
  ["g", "г"],
  ["d", "д"],
  ["e", "е"],
  ["z", "з"],
  ["i", "и"],
  ["y", "й"],
  ["k", "к"],
  ["q", "к"],
  ["l", "л"],
  ["m", "м"],
  ["n", "н"],
  ["o", "о"],
  ["p", "п"],
  ["r", "р"],
  ["s", "с"],
  ["t", "т"],
  ["u", "у"],
  ["f", "ф"],
  ["h", "х"],
  ["x", "х"],
  ["c", "ц"],
  ["j", "ж"],
];

/** True when the text has Latin letters but no Cyrillic ones. */
export function isLatin(text: string): boolean {
  return /[a-z]/i.test(text) && !/[Ѐ-ӿ]/.test(text);
}

/**
 * Rewrites Latin words as Cyrillic, leaving anything already Cyrillic alone.
 *
 * Word by word rather than over the whole string: a query like `nike дънки`
 * mixes both, and a brand written in Latin should stay in Latin so it can
 * still match the brand in a product title.
 */
export function toCyrillic(text: string): string {
  return normalize(text)
    .split(" ")
    .map((word) => {
      if (!isLatin(word)) return word;

      let out = "";
      let index = 0;
      while (index < word.length) {
        const hit = TRANSLITERATIONS.find(([latin]) =>
          word.startsWith(latin, index),
        );
        if (hit) {
          out += hit[1];
          index += hit[0].length;
        } else {
          out += word[index];
          index += 1;
        }
      }
      return out;
    })
    .join(" ");
}

/** Padded trigrams, the way Postgres's pg_trgm builds them. */
export function trigrams(text: string): Set<string> {
  const set = new Set<string>();

  for (const word of normalize(text).split(" ")) {
    if (!word) continue;
    const padded = `  ${word} `;
    for (let i = 0; i < padded.length - 2; i += 1) {
      set.add(padded.slice(i, i + 3));
    }
  }

  return set;
}

/**
 * Overlap coefficient over trigrams: shared, over the size of the smaller set.
 *
 * Dice was the obvious choice and it is wrong here, which the tests caught. A
 * product title is a sentence — `дънки в по-светъл деним с модерна визия` is
 * about 45 trigrams — and a query is one word. Dice divides by the sum of both
 * sets, so even a perfect, exactly-spelled `дънки` scores 0.27: it is being
 * marked down for everything the title says that the query did not.
 *
 * Dividing by the smaller set asks the question actually being asked — how much
 * of what they typed appears in this title — and a contained query scores 1.
 *
 * The known cost is that very short queries match too much, since two or three
 * trigrams find a home in almost any sentence. `rank` holds the floor for that
 * rather than this function pretending to.
 */
export function similarity(a: string, b: string): number {
  const left = trigrams(a);
  const right = trigrams(b);
  if (left.size === 0 || right.size === 0) return 0;

  let shared = 0;
  for (const gram of left) if (right.has(gram)) shared += 1;

  return shared / Math.min(left.size, right.size);
}

export interface Scored<T> {
  item: T;
  score: number;
}

/**
 * Ranks candidates against a query, in both scripts.
 *
 * The query is scored as typed and again transliterated, and the better of the
 * two wins. That way a Cyrillic query is never made worse by a rewrite it did
 * not need, and a Latin one gets its chance.
 */
export function rank<T>(
  query: string,
  candidates: T[],
  textOf: (item: T) => string,
  { threshold = 0.45, limit = 5 }: { threshold?: number; limit?: number } = {},
): Scored<T>[] {
  const typed = normalize(query);
  const converted = toCyrillic(query);

  /* Three characters is the floor. Below it a query is one or two trigrams,
     which land somewhere in almost any sentence, and the overlap coefficient
     scores that as a perfect hit — `ри` would return the whole catalogue.
     Nothing findable in this shop is named in two letters. */
  if (typed.replace(/\s/g, "").length < 3) return [];

  return candidates
    .map((item) => {
      const text = textOf(item);
      return {
        item,
        score: Math.max(similarity(typed, text), similarity(converted, text)),
      };
    })
    .filter((entry) => entry.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * The article number in a message, if there is one.
 *
 * Four to six digits standing alone. Bounded on both sides so a size (`32`), a
 * price (`45,00`) and a phone number do not read as one — the shop's articles
 * are five digits, and the range gives room without swallowing everything.
 */
export function articleNumber(text: string): string | null {
  const match = text.match(/(?:^|\D)(\d{4,6})(?:\D|$)/);
  return match?.[1] ?? null;
}
