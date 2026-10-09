/** Reads one JSON object out of a model's reply (tolerates a ```json fence or text around it). */
export function extractJson(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "The reply was empty." };
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const body = fenced ? fenced[1].trim() : trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return { ok: false, error: "The reply did not contain a JSON object." };
  try {
    return { ok: true, value: JSON.parse(body.slice(start, end + 1)) };
  } catch (e) {
    return { ok: false, error: `The reply was not valid JSON (${e instanceof Error ? e.message.slice(0, 120) : "parse error"}).` };
  }
}
