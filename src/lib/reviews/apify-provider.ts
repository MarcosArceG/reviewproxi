import type { NormalizedReview } from "@/lib/reviews/types";
import { hasOwnerReplyInRaw } from "@/lib/reviews/owner-reply";

function normalizeUrl(u?: string | null): string | null {
  if (!u || typeof u !== "string") return null;
  let url = u.trim();
  if (!url) return null;
  if (url.startsWith("//")) url = "https:" + url;
  return url;
}

function pickPhotoUrl(it: Record<string, unknown>): string | null {
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

  const candidates = [it.reviewer, it.author, it.user].filter(
    (x) => x && typeof x === "object"
  ) as Record<string, unknown>[];

  const nameMap = new Set([
    "photo",
    "photoUrl",
    "profilePhoto",
    "profilePhotoUrl",
    "image",
    "imageUrl",
    "avatar",
    "avatarUrl",
    "thumbnail",
    "thumbnailUrl",
  ]);

  for (const obj of candidates) {
    for (const [k, v] of Object.entries(obj)) {
      if (!nameMap.has(k) || typeof v !== "string") continue;
      const norm = normalizeUrl(v);
      if (norm) return norm;
    }
    for (const v of Object.values(obj)) {
      if (!v || typeof v !== "object") continue;
      for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) {
        if (!nameMap.has(k2) || typeof v2 !== "string") continue;
        const norm = normalizeUrl(v2);
        if (norm) return norm;
      }
    }
  }

  return null;
}

function parseReviewDate(item: Record<string, unknown>): Date | null {
  const candidates = [item.publishedAt, item.publishedAtDate, item.date, item.time];
  for (const c of candidates) {
    if (!c) continue;
    const d = new Date(String(c));
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function pickExternalId(it: Record<string, unknown>): string | null {
  const id =
    it.reviewId ||
    it.id ||
    it.review_id ||
    it.googleReviewId ||
    it.reviewUrl;
  if (id == null) return null;
  const s = String(id).trim();
  return s || null;
}

async function runApify(actorId: string, token: string, urlGoogle: string) {
  const cleaned = actorId.trim().toLowerCase().replace("/", "~");
  const qs = new URLSearchParams({ token, limit: "50", clean: "true" });
  const input = {
    startUrls: [{ url: urlGoogle }],
    maxReviews: 50,
    reviewsSort: "newest",
    language: "es",
  };

  const url = `https://api.apify.com/v2/acts/${cleaned}/run-sync-get-dataset-items?${qs}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Apify error ${res.status}: ${body || res.statusText}`);
  }

  const data = await res.json();
  if (Array.isArray(data)) {
    const looksLikeReviews = data.some(
      (x) => typeof x?.text === "string" || x?.rating || x?.reviewText
    );
    if (looksLikeReviews) return data;
    const flattened = data.flatMap((place: { reviews?: unknown[] }) =>
      Array.isArray(place?.reviews) ? place.reviews : []
    );
    if (flattened.length) return flattened;
    return data;
  }
  if (data?.reviews && Array.isArray(data.reviews)) return data.reviews;
  return Object.values(data || {});
}

export function isApifyConfigured(): boolean {
  return Boolean(process.env.APIFY_TOKEN);
}

export async function fetchReviewsFromApify(
  urlGoogle: string,
  limit = 10
): Promise<NormalizedReview[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("Falta APIFY_TOKEN");

  const actorId = (
    process.env.APIFY_ACTOR_ID || "compass/google-maps-reviews-scraper"
  ).toLowerCase();

  const items = await runApify(actorId, token, urlGoogle);

  const normalized: NormalizedReview[] = items.map((raw: Record<string, unknown>) => {
    const authorName =
      (raw.reviewerName as string) ||
      (raw.authorName as string) ||
      (raw.userName as string) ||
      (raw.name as string) ||
      null;

    const text = String(
      raw.text || raw.reviewText || raw.snippet || raw.description || ""
    );

    const stars =
      Number(
        raw.rating ?? raw.stars ?? raw.score ?? raw.userRating ?? raw.reviewRating ?? 0
      ) || 0;

    const externalId = pickExternalId(raw);

    return {
      externalId: externalId ? `apify:${externalId}` : null,
      source: "APIFY" as const,
      authorName,
      authorPhotoUrl: pickPhotoUrl(raw),
      text,
      stars,
      date: parseReviewDate(raw) || new Date(),
      rawJson: raw,
      hasOwnerReply: hasOwnerReplyInRaw(raw),
    };
  });

  return normalized
    .filter((r) => r.text.trim().length > 0 && !r.hasOwnerReply)
    .slice(0, limit);
}
