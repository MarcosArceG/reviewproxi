const SYSTEM_INSTRUCTION =
  "Eres un asistente que redacta respuestas breves y profesionales a reseñas en español.";

export function buildReviewDraftPrompt(review: {
  authorName?: string | null;
  text?: string;
  stars?: number;
}) {
  return `Eres el community manager de un negocio local.
Genera una respuesta breve, profesional y cercana a esta reseña en español:

- Nombre del autor: ${review.authorName || "Cliente"}
- Puntuación: ${typeof review.stars === "number" ? review.stars : "N/D"}
- Reseña: """${(review.text || "").slice(0, 1200)}"""

Instrucciones:
- Agradece si la reseña es positiva.
- Si es negativa (<= 3 estrellas), empatiza y ofrece solución.
- No inventes datos. No uses emojis. 3-5 frases máximo.`;
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
        maxOutputTokens: 220,
      },
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Gemini error ${res.status}: ${txt || res.statusText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof text === "string" ? text.trim() : "";
}
