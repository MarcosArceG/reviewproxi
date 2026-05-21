import type { GoogleConnection } from "@prisma/client";
import type { NormalizedReview } from "@/lib/reviews/types";
import { getValidAccessToken } from "@/lib/google/tokens";

const MYBUSINESS_BASE = "https://mybusiness.googleapis.com/v4";

async function googleFetch<T>(
  accessToken: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${MYBUSINESS_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Google Business API ${res.status} ${path}: ${body || res.statusText}`
    );
  }

  if (res.status === 204) return {} as T;
  return res.json() as Promise<T>;
}

type Account = { name: string; accountName?: string };
type Location = { name: string; locationName?: string; metadata?: { placeId?: string } };
type GoogleReview = {
  name?: string;
  reviewId?: string;
  reviewer?: { displayName?: string; profilePhotoUrl?: string };
  comment?: string;
  starRating?: string;
  createTime?: string;
  updateTime?: string;
};

const STAR_MAP: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

function parseStarRating(starRating?: string): number {
  if (!starRating) return 0;
  return STAR_MAP[starRating] ?? (Number(starRating) || 0);
}

function reviewExternalId(review: GoogleReview): string | null {
  if (review.reviewId) return review.reviewId;
  if (review.name) {
    const parts = review.name.split("/");
    return parts[parts.length - 1] || review.name;
  }
  return null;
}

/** Lista cuentas del usuario autenticado. */
export async function listGoogleAccounts(accessToken: string): Promise<Account[]> {
  const data = await googleFetch<{ accounts?: Account[] }>(accessToken, "/accounts");
  return data.accounts || [];
}

/** Lista ubicaciones de una cuenta. */
export async function listGoogleLocations(
  accessToken: string,
  accountName: string
): Promise<Location[]> {
  const data = await googleFetch<{ locations?: Location[] }>(
    accessToken,
    `/${accountName}/locations`
  );
  return data.locations || [];
}

/**
 * Tras OAuth: elige la primera cuenta/ubicación si no hay una guardada.
 * En producción conviene una pantalla de selección.
 */
export async function resolveDefaultLocation(
  accessToken: string
): Promise<{ accountName: string; locationName: string; placeId: string | null }> {
  const accounts = await listGoogleAccounts(accessToken);
  if (!accounts.length) {
    throw new Error(
      "No se encontraron cuentas de Google Business. Verifica permisos OAuth."
    );
  }

  const accountName = accounts[0].name!;
  const locations = await listGoogleLocations(accessToken, accountName);
  if (!locations.length) {
    throw new Error("No se encontraron ubicaciones en la cuenta de Google Business.");
  }

  const loc = locations[0];
  return {
    accountName,
    locationName: loc.name!,
    placeId: loc.metadata?.placeId ?? null,
  };
}

export async function fetchReviewsFromGoogle(
  connection: GoogleConnection,
  limit = 10
): Promise<NormalizedReview[]> {
  if (connection.status !== "CONNECTED" || !connection.locationName) {
    throw new Error("Google no está conectado o falta locationName");
  }

  const accessToken = await getValidAccessToken(connection);
  const locationName = connection.locationName;
  if (!locationName) throw new Error("Falta locationName en la conexión Google");

  const path = `/${locationName}/reviews`;
  const data = await googleFetch<{ reviews?: GoogleReview[] }>(accessToken, path);

  return (data.reviews || []).slice(0, limit).map((r) => {
    const externalId = reviewExternalId(r);
    const dateStr = r.createTime || r.updateTime;
    return {
      externalId: externalId ? `google:${externalId}` : null,
      source: "GOOGLE" as const,
      authorName: r.reviewer?.displayName ?? null,
      authorPhotoUrl: r.reviewer?.profilePhotoUrl ?? null,
      text: r.comment || "",
      stars: parseStarRating(r.starRating),
      date: dateStr ? new Date(dateStr) : new Date(),
      rawJson: r,
    };
  });
}

/**
 * Publica la respuesta en Google Business Profile.
 * @see https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/updateReply
 */
export async function postReviewReplyOnGoogle(
  connection: GoogleConnection,
  reviewExternalId: string,
  comment: string
): Promise<void> {
  const accessToken = await getValidAccessToken(connection);
  const locationName = connection.locationName;
  if (!locationName) throw new Error("Conexión Google incompleta (ubicación)");

  const googleId = reviewExternalId.replace(/^google:/, "");
  const reviewName = `${locationName}/reviews/${googleId}`;

  await googleFetch(accessToken, `/${reviewName}/reply`, {
    method: "PUT",
    body: JSON.stringify({ comment }),
  });
}
