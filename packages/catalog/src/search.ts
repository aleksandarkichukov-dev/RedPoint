/**
 * Turning what someone typed into something the catalogue can be searched by.
 *
 * The brief calls this the most underestimated part of the chatbot, and it is
 * right. Bulgarians type the same word four ways — `дънки`, `denki`, `danki`,
 * `dunki` — and an exact match answers one of them.
 *
 * The pipeline is four steps, each able to be wrong on its own without
 * breaking the next:
 *
 *   1. normalise   lowercase, strip Latin accents, collapse whitespace
 *   2. cyrillicise Latin to Cyrillic, longest digraphs first
 *   3. compare     trigram overlap, per word, because step 2 cannot be exact
 *   4. fall back   compare consonant skeletons when the spelling misses
 *
 * Step 4 exists because step 3 was not enough, which took measuring to find
 * out. `ъ` has no Latin letter, so `denki`, `danki` and `dunki` all arrive one
 * vowel wrong, and `денки` against `дънки` scores 0.50 — the same as noise.
 * Drop the vowels and all three read `днк`, which is `дънки` exactly.
 *
 * No Medusa and no HTTP in here, so it is testable with plain node.
 */

/** Lowercase, unaccented, single-spaced. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    /* Accents are stripped from Latin letters only. Stripping them everywhere
       is the obvious version and it is wrong: `й` decomposes to `и` plus a
       combining breve, so `здравейте` came out as `здравеите` and stopped
       matching a keyword list written in ordinary Bulgarian. `й` and `ѝ` are
       letters here, not decoration. */
    .normalize("NFD")
    .replace(/([a-z])[̀-ͯ]+/g, "$1")
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
 * A word with its vowels removed.
 *
 * This is how the `ъ` problem is finally closed. No Latin letter stands for it,
 * so `denki`, `danki` and `dunki` all arrive one vowel wrong, and trigram
 * overlap puts `денки` against `дънки` at 0.50 — the same score noise reaches.
 * Strip the vowels and all three become `днк`, which is `дънки` exactly, while
 * `анорак` and `качулка` stay at zero.
 *
 * Below three consonants it is switched off: `риза` and `роза` both reduce to
 * `рз`, and at that length the skeleton stops identifying a word.
 */
function skeleton(word: string): string {
  return word.replace(/[аеиоуъюяьaeiouy]/g, "");
}

/** The better of the two readings of one word, spelled and skeletal. */
function wordScore(query: string, candidate: string): number {
  const direct = similarity(query, candidate);
  if (direct === 1) return 1;

  const left = skeleton(query);
  const right = skeleton(candidate);
  if (left.length < 3 || right.length < 3) return direct;

  /* Discounted, so a correctly spelled match always outranks a skeletal one
     and the ordering never turns on a vowel nobody typed. */
  return Math.max(direct, similarity(left, right) * 0.95);
}

/**
 * How much of a query a piece of text answers, word by word.
 *
 * Comparing the whole query as one bag of trigrams is the obvious version and
 * it fails on real sentences. `дай да видя черни тениски` returned cargo
 * trousers and sandals: filler words carry trigrams that live in every
 * Bulgarian sentence, and once a query is long enough, a long text contains
 * most of them by chance — which the overlap coefficient, dividing by the
 * smaller set, scores as a strong hit.
 *
 * Scoring each word against each word of the text and averaging asks the
 * question properly: a title answering `черни` and `тениски` beats one
 * answering neither, whatever else it happens to contain.
 */
export function coverage(query: string, text: string): number {
  const queryWords = normalize(query).split(" ").filter((word) => word.length >= 3);
  const textWords = normalize(text).split(" ").filter(Boolean);
  if (queryWords.length === 0 || textWords.length === 0) return 0;

  let total = 0;
  for (const word of queryWords) {
    let best = 0;
    for (const candidate of textWords) {
      best = Math.max(best, wordScore(word, candidate));
      if (best === 1) break;
    }
    total += best;
  }

  return total / queryWords.length;
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
  { threshold = 0.6, limit = 5 }: { threshold?: number; limit?: number } = {},
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
        score: Math.max(coverage(typed, text), coverage(converted, text)),
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
