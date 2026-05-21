const SYSTEM_INSTRUCTION =
  "Eres un asistente que redacta respuestas breves y profesionales a reseñas en español, sin asumir un tipo concreto de negocio.";

export type ReviewDraftContext = {
  authorName?: string | null;
  text?: string | null;
  stars: number;
  businessName?: string | null;
};

export function hasReviewText(text?: string | null): boolean {
  return Boolean(text?.trim());
}

export function isRatingOnlyReview(text?: string | null): boolean {
  return !hasReviewText(text);
}

export function shouldSkipAutoDraft(stars: number, text?: string | null): boolean {
  return isRatingOnlyReview(text) && stars <= 3;
}

export function usesRatingOnlyTemplate(stars: number, text?: string | null): boolean {
  return isRatingOnlyReview(text) && stars >= 4;
}

function displayName(authorName?: string | null): string {
  const name = authorName?.trim();
  return name || "Cliente";
}

function businessLabel(businessName?: string | null): string {
  const n = businessName?.trim();
  return n || "nuestro equipo";
}

function starsLabel(stars: number): string {
  if (stars >= 5) return "5 estrellas";
  if (stars === 4) return "4 estrellas";
  return `${stars} estrellas`;
}

/**
 * Plantilla neutra (servicios, talleres, clínicas, comercio, etc.).
 * Sin referencias a “visita”, “local” ni “volver pronto”.
 */
export function buildRatingOnlyThankYouDraft(
  authorName: string | null | undefined,
  stars: number,
  businessName?: string | null
): string | null {
  if (stars <= 3) return null;

  const nombre = displayName(authorName);
  const negocio = businessLabel(businessName);
  const estrellas = starsLabel(stars);

  if (stars >= 5) {
    return `Muchas gracias, ${nombre}, por tu valoración de ${estrellas}. En ${negocio} nos alegra saber que quedaste satisfecho/a con nuestro servicio.`;
  }

  return `Muchas gracias, ${nombre}, por tu valoración de ${estrellas}. En ${negocio} agradecemos tu confianza y seguimos a tu disposición.`;
}

/** Detecta plantillas antiguas (tono “negocio local” / texto truncado). */
export function isLegacyRatingOnlyDraft(draft: string): boolean {
  const d = draft.trim();
  if (!d) return false;
  return (
    /por\s*\.{1,}\s*$/i.test(d) ||
    /por tu reseña de/i.test(d) ||
    /esperamos verte de nuevo/i.test(d) ||
    /negocio local/i.test(d)
  );
}

export function shouldReplaceRatingOnlyDraft(
  existingDraft: string | null | undefined,
  authorName: string | null | undefined,
  stars: number,
  text?: string | null,
  businessName?: string | null
): boolean {
  if (!usesRatingOnlyTemplate(stars, text)) return false;

  const expected = buildRatingOnlyThankYouDraft(authorName, stars, businessName);
  if (!expected) return false;

  const d = (existingDraft || "").trim();
  if (!d) return true;
  if (d === expected) return false;
  if (isLegacyRatingOnlyDraft(d)) return true;
  if (d.length < expected.length * 0.75) return true;

  return false;
}

export function buildReviewDraftPrompt(review: ReviewDraftContext) {
  const texto = (review.text || "").trim();
  const negocio = businessLabel(review.businessName);

  return `Redacta una respuesta breve y profesional en español en nombre de "${negocio}".

- Autor de la reseña: ${review.authorName || "Cliente"}
- Puntuación: ${typeof review.stars === "number" ? review.stars : "N/D"}
- Texto de la reseña: """${texto.slice(0, 1200)}"""

Instrucciones:
- Tono cercano y profesional; no asumas si es restaurante, tienda o servicio técnico (puede ser cualquier sector).
- Agradece si la valoración es positiva; si es baja (<=3 estrellas), muestra empatía y disposición a ayudar, sin prometer cosas concretas.
- No inventes datos, precios ni plazos. No uses emojis. 2-4 frases completas.`;
}

export async function generateReviewDraftWithGemini(
  review: ReviewDraftContext
): Promise<string> {
  const prompt = buildReviewDraftPrompt(review);
  return generateReviewDraft(prompt);
}

export async function generateReviewDraft(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  if (!apiKey) throw new Error("Falta GEMINI_API_KEY");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 280,
      },
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Gemini error ${res.status}: ${txt || res.statusText}`);
  }

  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof raw === "string" ? raw.trim() : "";
}

export async function resolveReviewDraftText(
  review: ReviewDraftContext & { text: string }
): Promise<string | null> {
  const texto = review.text.trim();

  if (!texto) {
    return buildRatingOnlyThankYouDraft(
      review.authorName,
      review.stars,
      review.businessName
    );
  }

  const draft = await generateReviewDraftWithGemini(review);
  return draft.trim() || null;
}
