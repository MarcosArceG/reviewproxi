/** Detecta si la reseña ya tiene respuesta del negocio (Apify / Google raw). */
export function hasOwnerReplyInRaw(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const r = raw as Record<string, unknown>;

  const textFields = [
    r.responseFromOwnerText,
    r.ownerResponse,
    r.ownerResponseText,
    r.responseText,
    r.businessResponse,
    r.replyText,
    r.reviewReply,
  ];

  for (const t of textFields) {
    if (typeof t === "string" && t.trim().length > 0) return true;
  }

  const dateFields = [r.responseFromOwnerDate, r.ownerResponseDate];
  for (const d of dateFields) {
    if (d != null && String(d).trim() !== "") return true;
  }

  const nested = r.responseFromOwner;
  if (nested && typeof nested === "object") {
    const o = nested as Record<string, unknown>;
    if (typeof o.text === "string" && o.text.trim()) return true;
  }

  return false;
}
