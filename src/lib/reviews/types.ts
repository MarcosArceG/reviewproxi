import type { ReviewSource } from "@prisma/client";

/** Reseña normalizada, independiente del proveedor (Apify o Google API). */
export type NormalizedReview = {
  externalId: string | null;
  source: ReviewSource;
  authorName: string | null;
  authorPhotoUrl: string | null;
  text: string;
  stars: number;
  date: Date;
  rawJson: unknown;
  /** Ya respondida por el negocio en Google Maps. */
  hasOwnerReply: boolean;
};

export type SyncProvider = "apify" | "google";

export type SyncResult = {
  ok: true;
  provider: SyncProvider;
  created: number;
  skipped: number;
  skippedAnswered: number;
  drafted: number;
};

export type PostReplyResult = {
  ok: true;
  postedToGoogle: boolean;
  reviewId: string;
  message?: string;
};
