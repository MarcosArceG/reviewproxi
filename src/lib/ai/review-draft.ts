const SYSTEM_INSTRUCTION =
  "Eres un asistente que redacta respuestas breves y profesionales a reseñas en español.";

export function hasReviewText(text?: string | null): boolean {
  return Boolean(text?.trim());
}

/** Reseña solo con estrellas, sin comentario escrito. */
export function isRatingOnlyReview(text?: string | null): boolean {
  return !hasReviewText(text);
}

/**
 * Reseñas ≤3 estrellas sin texto: no generamos borrador automático (respuesta manual).
 */
export function shouldSkipAutoDraft(stars: number, text?: string | null): boolean {
  return isRatingOnlyReview(text) && stars <= 3;
}

function displayName(authorName?: string | null): string {
  const name = authorName?.trim();
  return name || "Cliente";
}

/** Plantilla fija para valoraciones positivas (4–5★) sin texto. */
export function buildRatingOnlyThankYouDraft(
  authorName: string | null | undefined,
  stars: number
): string | null {
  if (stars <= 3) return null;

  const nombre = displayName(authorName);
  const estrellas =
    stars === 1
      ? "1 estrella"
      : stars >= 5
        ? "5 estrellas"
        : `${stars} estrellas`;

  if (stars >= 5) {
    return `Muchas gracias, ${nombre}, por tu reseña de ${estrellas}. Nos alegra mucho tu valoración y esperamos verte de nuevo pronto.`;
  }

  return `Muchas gracias, ${nombre}, por tu reseña de ${estrellas}. Agradecemos tu valoración y seguimos trabajando para ofrecerte la mejor experiencia.`;
}

export function buildReviewDraftPrompt(review: {
  authorName?: string | null;
  text?: string;
  stars?: number;
}) {
  const texto = (review.text || "").trim();
  return `Eres el community manager de un negocio local.
Genera una respuesta breve, profesional y cercana a esta reseña en español:

- Nombre del autor: ${review.authorName || "Cliente"}
- Puntuación: ${typeof review.stars === "number" ? review.stars : "N/D"}
- Reseña: """${texto.slice(0, 1200)}"""

Instrucciones:
- Agradece si la reseña es positiva.
- Si es negativa (<= 3 estrellas), empatiza y ofrece solución.
- No inventes datos. No uses emojis. 2-4 frases como máximo.
- Respuesta completa, sin cortar frases.`;
}

export async function generateReviewDraftWithGemini(
  authorName: string | null | undefined,
  text: string,
  stars: number
): Promise<string> {
  const prompt = buildReviewDraftPrompt({ authorName, text, stars });
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

/**
 * Decide el borrador: plantilla (solo estrellas +), Gemini (con texto) o null (≤3★ sin texto).
 */
export async function resolveReviewDraftText(review: {
  authorName: string | null;
  text: string;
  stars: number;
}): Promise<string | null> {
  const texto = review.text.trim();

  if (!texto) {
    return buildRatingOnlyThankYouDraft(review.authorName, review.stars);
  }

  const draft = await generateReviewDraftWithGemini(
    review.authorName,
    texto,
    review.stars
  );
  return draft.trim() || null;
}
