/**
 * The scorer is code, never a model: it reads the last number in a reply and
 * compares it with the exact answer. A reply with no number, or whose last
 * number is not an integer, is wrong.
 */

/** The last number in the text, as written ("12,345", "−17", "42.0"); null when there is none. */
export function finalNumber(text: string): number | null {
  const t = text.replace(/−/g, "-").replace(/[*_`]/g, "");
  const re = /(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?/g;
  let last: number | null = null;
  for (let m = re.exec(t); m; m = re.exec(t)) {
    // A number glued to a letter or a dot before it ("v2", ".5") is not an answer.
    const before = t[m.index - 1] ?? "";
    if (/[A-Za-z.]/.test(before)) continue;
    let value = Number(m[1].replace(/,/g, "") + (m[2] ? `.${m[2]}` : ""));
    // A minus sign counts when it is not a hyphen between words or numbers ("2-3", "step-4").
    if (before === "-" && !/[A-Za-z0-9]/.test(t[m.index - 2] ?? "")) value = -value;
    last = value;
  }
  return last;
}

/**
 * The answer: the number on the last "Answer: …" line when there is one (so a
 * remark after it cannot change the score), else the last number in the text.
 * Null when that number is not an integer.
 */
export function finalInteger(text: string): number | null {
  const lines = [...text.matchAll(/answer\s*[:=]\s*([^\n]*)/gi)];
  const marked = lines.length ? finalNumber(lines[lines.length - 1][1].replace(/\(.*$/, "")) : null;
  const n = marked ?? finalNumber(text);
  return n !== null && Number.isInteger(n) ? n : null;
}

export interface Scored {
  score: 0 | 1;
  parsed: number | null;
  rationale: string;
}

export function scoreReply(text: string, answer: number): Scored {
  const parsed = finalInteger(text);
  if (parsed === null) return { score: 0, parsed, rationale: `No final integer found; expected ${answer}.` };
  return parsed === answer
    ? { score: 1, parsed, rationale: `Final integer ${parsed} equals the exact answer.` }
    : { score: 0, parsed, rationale: `Final integer ${parsed}; expected ${answer}.` };
}
