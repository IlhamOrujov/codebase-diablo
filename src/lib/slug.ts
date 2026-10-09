/**
 * URL-safe ids for investigations: an ASCII slug of the title plus a short
 * random id, e.g. "does-model-x-refuse-k3f9q2". Cyrillic and Azerbaijani are
 * transliterated; anything else that has no Latin form is dropped, and an
 * empty result falls back to "investigation".
 */

const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", ғ: "g", д: "d", е: "e", ё: "yo", є: "ye", ж: "zh", з: "z", и: "i", і: "i",
  ї: "yi", й: "y", ј: "j", к: "k", қ: "q", л: "l", м: "m", н: "n", ң: "n", о: "o", ө: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ү: "u", ұ: "u", ф: "f", х: "kh", һ: "h", ц: "ts", ч: "ch", ҹ: "c", ш: "sh",
  щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya", ґ: "g",
};

/** Azerbaijani and Turkish letters that NFKD does not decompose. */
const LATIN_EXTRA: Record<string, string> = { ə: "e", ı: "i", ø: "o", ß: "ss", æ: "ae", œ: "oe", đ: "d", ł: "l", þ: "th" };

export function slugify(text: string, maxLength = 48): string {
  const lower = text.toLowerCase();
  let out = "";
  for (const ch of lower) out += CYRILLIC[ch] ?? LATIN_EXTRA[ch] ?? ch;
  const ascii = out
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // combining marks: ç → c, ğ → g, ş → s, ö → o, ü → u
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const cut = ascii.length > maxLength ? ascii.slice(0, maxLength).replace(/-[^-]*$/, "") || ascii.slice(0, maxLength) : ascii;
  return cut.replace(/-+$/g, "") || "investigation";
}

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function shortId(length = 6): string {
  const bytes = new Uint8Array(length);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  let s = "";
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return s;
}

export function investigationId(title: string): string {
  return `${slugify(title)}-${shortId()}`;
}

/** Ids created in the browser have this shape; the server 404s anything else that is not a seeded id. */
export const CREATED_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*-[a-z0-9]{6}$/;

/** A readable title from a question: no trailing punctuation, capitalised, at most `max` characters. */
export function titleFromQuestion(question: string, max = 60): string {
  const bare = question.trim().replace(/\s+/g, " ").replace(/[\s?.!…]+$/u, "");
  const cap = bare.charAt(0).toLocaleUpperCase("en-US") + bare.slice(1);
  if (cap.length <= max) return cap || "Untitled investigation";
  const cut = cap.slice(0, max - 1);
  const atWord = cut.replace(/\s+\S*$/, "");
  return `${(atWord.length > max * 0.6 ? atWord : cut).trimEnd()}…`;
}
