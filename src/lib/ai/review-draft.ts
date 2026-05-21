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
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  if (!apiKey) throw new Error("Falta OPENAI_API_KEY");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "Eres un asistente que redacta respuestas breves y profesionales a reseñas en español.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 220,
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`OpenAI error ${res.status}: ${txt || res.statusText}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || "";
}
