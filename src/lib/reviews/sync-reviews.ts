import {
  shouldReplaceRatingOnlyDraft,
  shouldSkipAutoDraft,
} from "@/lib/ai/review-draft";
import { prisma } from "@/lib/prisma";
import { generateDraftForReview } from "@/lib/reviews/generate-draft";
import {
  fetchReviewsForCliente,
  getClienteWithGoogle,
  resolveSyncProvider,
} from "@/lib/reviews/provider";
import type { NormalizedReview, SyncResult } from "@/lib/reviews/types";

async function findExistingReview(
  clienteId: string,
  item: NormalizedReview
) {
  if (item.externalId) {
    return prisma.review.findUnique({
      where: {
        clienteId_externalId: { clienteId, externalId: item.externalId },
      },
      select: {
        id: true,
        authorName: true,
        text: true,
        stars: true,
        reply: { select: { draftText: true } },
      },
    });
  }

  return prisma.review.findFirst({
    where: { clienteId, text: item.text, date: item.date },
    select: {
      id: true,
      authorName: true,
      text: true,
      stars: true,
      reply: { select: { draftText: true } },
    },
  });
}

async function ensureDraftIfMissing(
  reviewId: string,
  authorName: string | null,
  text: string,
  stars: number,
  existingDraft?: string | null
) {
  if (shouldSkipAutoDraft(stars, text)) return false;

  const hasDraft = Boolean(existingDraft?.trim());
  const mustRefresh = shouldReplaceRatingOnlyDraft(
    existingDraft,
    authorName,
    stars,
    text
  );

  if (hasDraft && !mustRefresh) return false;

  const result = await generateDraftForReview(reviewId);
  return result.ok;
}

export async function syncClienteReviews(slugOrId: string): Promise<SyncResult> {
  const cliente = await getClienteWithGoogle(slugOrId);
  if (!cliente) throw new Error("Cliente no encontrado");

  const provider = resolveSyncProvider(cliente);
  const existingCount = await prisma.review.count({
    where: { clienteId: cliente.id },
  });
  const isInitialSync = existingCount === 0;
  const { reviews } = await fetchReviewsForCliente(cliente, {
    initial: isInitialSync,
  });

  let created = 0;
  let skipped = 0;
  let skippedAnswered = 0;
  let drafted = 0;

  for (const item of reviews) {
    if (item.hasOwnerReply) {
      skippedAnswered++;
      continue;
    }

    const existing = await findExistingReview(cliente.id, item);
    if (existing) {
      skipped++;
      try {
        if (
          await ensureDraftIfMissing(
            existing.id,
            existing.authorName,
            existing.text,
            existing.stars,
            existing.reply?.draftText
          )
        ) {
          drafted++;
        }
      } catch (err) {
        console.warn(`Draft backfill failed for review ${existing.id}:`, err);
      }
      continue;
    }

    const review = await prisma.review.create({
      data: {
        clienteId: cliente.id,
        externalId: item.externalId,
        source: item.source,
        authorName: item.authorName,
        authorPhotoUrl: item.authorPhotoUrl,
        text: item.text,
        stars: item.stars,
        date: item.date,
        rawJson: item.rawJson as object,
        status: "PENDIENTE",
      },
      select: { id: true },
    });
    created++;

    try {
      const result = await generateDraftForReview(review.id);
      if (result.ok) drafted++;
    } catch (err) {
      console.error(`Draft failed for new review ${review.id}:`, err);
    }
  }

  if (provider === "google" && cliente.googleConnection) {
    await prisma.googleConnection.update({
      where: { id: cliente.googleConnection.id },
      data: { lastSyncAt: new Date(), lastError: null },
    });
  }

  return {
    ok: true,
    provider,
    initial: isInitialSync,
    created,
    skipped,
    skippedAnswered,
    drafted,
  };
}
