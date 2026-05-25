import type { Cliente, GoogleConnection } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isGoogleOAuthConfigured } from "@/lib/google/config";
import { fetchReviewsFromApify, isApifyConfigured } from "@/lib/reviews/apify-provider";
import { fetchReviewsFromGoogle } from "@/lib/google/business-api";
import {
  applyIncrementalSyncLimit,
  applyInitialSyncWindow,
  INITIAL_SYNC_MAX_REVIEWS,
  INCREMENTAL_SYNC_MAX_REVIEWS,
} from "@/lib/reviews/sync-policy";
import type { NormalizedReview, SyncProvider } from "@/lib/reviews/types";

export type ClienteWithGoogle = Cliente & {
  googleConnection: GoogleConnection | null;
};

export type FetchReviewsOptions = {
  /** Primera importación: hasta 100 del último año. */
  initial?: boolean;
  limit?: number;
};

export async function getClienteWithGoogle(
  slugOrId: string
): Promise<ClienteWithGoogle | null> {
  let cliente = await prisma.cliente.findUnique({
    where: { id: slugOrId },
    include: { googleConnection: true },
  });
  if (cliente) return cliente;

  return prisma.cliente.findUnique({
    where: { slug: slugOrId },
    include: { googleConnection: true },
  });
}

/** Google conectado y listo para API oficial. */
export function canUseGoogleApi(connection: GoogleConnection | null): boolean {
  return (
    isGoogleOAuthConfigured() &&
    connection?.status === "CONNECTED" &&
    Boolean(connection.locationName && connection.accessToken)
  );
}

/** Proveedor activo para sincronizar reseñas. */
export function resolveSyncProvider(cliente: ClienteWithGoogle): SyncProvider {
  if (canUseGoogleApi(cliente.googleConnection)) return "google";
  return "apify";
}

export async function fetchReviewsForCliente(
  cliente: ClienteWithGoogle,
  options: FetchReviewsOptions = {}
): Promise<{ provider: SyncProvider; reviews: NormalizedReview[] }> {
  const provider = resolveSyncProvider(cliente);
  const initial = options.initial === true;
  const fetchLimit = initial
    ? INITIAL_SYNC_MAX_REVIEWS
    : (options.limit ?? INCREMENTAL_SYNC_MAX_REVIEWS);

  let reviews: NormalizedReview[];

  if (provider === "google" && cliente.googleConnection) {
    reviews = await fetchReviewsFromGoogle(cliente.googleConnection, fetchLimit);
  } else {
    if (!cliente.urlGoogle) {
      throw new Error("El cliente no tiene urlGoogle configurada (modo demo Apify)");
    }
    if (!isApifyConfigured()) {
      throw new Error("Falta APIFY_TOKEN para sincronización demo");
    }
    reviews = await fetchReviewsFromApify(cliente.urlGoogle, fetchLimit, {
      initial,
    });
  }

  if (initial) {
    reviews = applyInitialSyncWindow(reviews);
  } else {
    reviews = applyIncrementalSyncLimit(reviews, fetchLimit);
  }

  return { provider, reviews };
}

/** Estado público de integración Google (sin tokens). */
export function getGooglePublicStatus(connection: GoogleConnection | null) {
  return {
    configured: isGoogleOAuthConfigured(),
    connected: connection?.status === "CONNECTED",
    status: connection?.status ?? null,
    locationName: connection?.locationName ?? null,
    connectedAt: connection?.connectedAt?.toISOString() ?? null,
    lastSyncAt: connection?.lastSyncAt?.toISOString() ?? null,
    lastError: connection?.lastError ?? null,
  };
}
