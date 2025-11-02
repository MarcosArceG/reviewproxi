// src/app/api/clientes/[slug]/sync/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const revalidate = 0;

/** Slug dinámico desde params o URL */
function getSlugFromRequest(req: Request, params?: Record<string, any>) {
  let slug = params?.slug;
  if (Array.isArray(slug)) slug = slug[0];
  if (typeof slug === "string" && slug.trim()) return slug.trim();
  const { pathname } = new URL(req.url);
  // .../api/clientes/[slug]/sync → penúltimo segmento es el slug
  const parts = pathname.replace(/\/+$/, "").split("/");
  return parts[parts.length - 2] || undefined;
}

async function getClienteByIdOrSlug(value: string) {
  let c = await prisma.cliente.findUnique({ where: { id: value } });
  if (c) return c;
  return prisma.cliente.findUnique({ where: { slug: value } });
}

/** Normaliza https: */
function normalizeUrl(u?: string | null): string | null {
  if (!u || typeof u !== "string") return null;
  let url = u.trim();
  if (!url) return null;
  if (url.startsWith("//")) url = "https:" + url;
  return url;
}

/**
 * Devuelve SOLO avatares del reseñador.
 * Evita fotos del negocio (place photos) al no buscar en el objeto completo.
 */
function pickPhotoUrl(it: any): string | null {
  // 1) Campos directos comunes en reviews
  const direct = [
    it.reviewerPhotoUrl,
    it.reviewerProfilePhoto,
    it.reviewerImageUrl,
    it.reviewerAvatarUrl,
    it.reviewerAvatar,
    it.authorPhotoUrl,
    it.authorProfilePhoto,
    it.authorImageUrl,
    it.userPhoto,
    it.userImageUrl,
    it.profilePhotoUrl,
    it.profilePhoto,
    it.avatarUrl,
    it.avatar,
    it.thumbnailUrl,
  ].filter(Boolean) as string[];

  for (const d of direct) {
    const norm = normalizeUrl(d);
    if (norm) return norm;
  }

  // 2) Buscar SOLO dentro de subobjetos típicos del usuario
  const candidates = [it.reviewer, it.author, it.user].filter(Boolean);

  const nameMap = new Set([
    "photo", "photoUrl",
    "profilePhoto", "profilePhotoUrl",
    "image", "imageUrl",
    "avatar", "avatarUrl",
    "thumbnail", "thumbnailUrl",
  ]);

  for (const obj of candidates) {
    if (!obj || typeof obj !== "object") continue;

    // a) chequeo directo por claves conocidas
    for (const [k, v] of Object.entries(obj)) {
      if (!nameMap.has(k)) continue;
      if (typeof v === "string") {
        const norm = normalizeUrl(v);
        if (norm) return norm;
      }
    }

    // b) un nivel más por si el actor anida (author.profile.photoUrl, etc.)
    for (const v of Object.values(obj)) {
      if (v && typeof v === "object") {
        for (const [k2, v2] of Object.entries(v)) {
          if (!nameMap.has(k2)) continue;
          if (typeof v2 === "string") {
            const norm = normalizeUrl(v2);
            if (norm) return norm;
          }
        }
      }
    }
  }

  // Si no encontramos avatar del reseñador, devolvemos null (mejor el placeholder)
  return null;
}

/** Lanza el actor de Apify y devuelve un array de reviews normalizado */
async function runApify(actorId: string, token: string, urlGoogle: string) {
  // Normaliza: minúsculas y tilde entre owner y actor para API REST
  // acepta "compass/google-maps-reviews-scraper" o "compass~google-maps-reviews-scraper"
  const cleaned = actorId.trim().toLowerCase().replace("/", "~");

  const qs = new URLSearchParams({
    token,
    limit: "50",   // pedimos más y luego cortamos a 10
    clean: "true",
  });

  const input = {
    startUrls: [{ url: urlGoogle }],
    maxReviews: 50,
    reviewsSort: "newest",
    language: "es",
  };

  const url = `https://api.apify.com/v2/acts/${cleaned}/run-sync-get-dataset-items?${qs.toString()}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Apify error ${res.status} @ ${url}\n${body || res.statusText}`);
  }

  const data = await res.json();

  // Normaliza: puede venir como lista de reviews, o lista de places con 'reviews'
  if (Array.isArray(data)) {
    const looksLikeReviews = data.some((x) => typeof x?.text === "string" || x?.rating || x?.reviewText);
    if (looksLikeReviews) return data;

    const flattened = data.flatMap((place: any) => Array.isArray(place?.reviews) ? place.reviews : []);
    if (flattened.length) return flattened;

    return data;
  }

  if (data?.reviews && Array.isArray(data.reviews)) {
    return data.reviews;
  }

  return Object.values(data || {});
}

/** Prompt para IA */
function buildPrompt(review: { authorName?: string; text?: string; stars?: number }) {
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

/** Llama OpenAI (REST) para generar borrador */
async function genAiDraft(apiKey: string, model: string, prompt: string) {
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

/** Intenta construir fecha desde varios campos comunes */
function parseReviewDate(item: any): Date | null {
  const candidates = [item.publishedAt, item.publishedAtDate, item.date, item.time];
  for (const c of candidates) {
    if (!c) continue;
    const d = new Date(c);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

export async function POST(req: Request, context: { params?: Record<string, any> } = {}) {
  try {
    const slug = getSlugFromRequest(req, context.params);
    if (!slug) return NextResponse.json({ error: "slug no proporcionado" }, { status: 400 });

    const cliente = await getClienteByIdOrSlug(slug);
    if (!cliente) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    if (!cliente.urlGoogle) {
      return NextResponse.json(
        { error: "El cliente no tiene urlGoogle configurada" },
        { status: 400 }
      );
    }

    const APIFY_TOKEN = process.env.APIFY_TOKEN;
    const APIFY_ACTOR_ID =
      (process.env.APIFY_ACTOR_ID || "compass/google-maps-reviews-scraper").toLowerCase();
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

    if (!APIFY_TOKEN) return NextResponse.json({ error: "Falta APIFY_TOKEN" }, { status: 500 });
    if (!OPENAI_API_KEY) return NextResponse.json({ error: "Falta OPENAI_API_KEY" }, { status: 500 });

    // 1) Scrapeo Apify
    const items = await runApify(APIFY_ACTOR_ID, APIFY_TOKEN, cliente.urlGoogle);

    let created = 0;
    let skipped = 0;
    let drafted = 0;

    for (const it of items.slice(0, 10)) {
      const authorName =
        it.reviewerName || it.authorName || it.userName || it.name || null;

      const authorPhotoUrl = pickPhotoUrl(it);

      const text = (it.text || it.reviewText || it.snippet || it.description || "").toString();

      const stars = Number(
        it.rating ?? it.stars ?? it.score ?? it.userRating ?? it.reviewRating ?? 0
      ) || 0;

      const date = parseReviewDate(it) || new Date();

      // Dedupe básico por cliente + (texto,fecha)
      const existing = await prisma.review.findFirst({
        where: { clienteId: cliente.id, text, date },
        select: { id: true },
      });
      if (existing) {
        skipped++;
        continue;
      }

      // 2) Crear Review
      const review = await prisma.review.create({
        data: {
          clienteId: cliente.id,
          authorName,
          authorPhotoUrl, // ahora será del reseñador o null (no del negocio)
          text,
          stars,
          date,
          rawJson: it,
          status: "PENDIENTE",
        },
        select: { id: true, text: true, stars: true, authorName: true },
      });
      created++;

      // 3) IA → Reply draft
      const prompt = buildPrompt({
        authorName: review.authorName || undefined,
        text: review.text,
        stars: review.stars,
      });
      const draftText = await genAiDraft(OPENAI_API_KEY!, OPENAI_MODEL, prompt);

      await prisma.reply.create({
        data: {
          reviewId: review.id,
          draftText,
          createdBy: "AI",
        },
      });
      drafted++;
    }

    return NextResponse.json({ ok: true, created, skipped, drafted }, { status: 200 });
  } catch (err: any) {
    console.error("SYNC error:", err);
    return NextResponse.json(
      { error: err?.message || "Error al sincronizar" },
      { status: 500 }
    );
  }
}
