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
      select: { id: true, reply: { select: { draftText: true } } },
    });
  }

  return prisma.review.findFirst({
    where: { clienteId, text: item.text, date: item.date },
    select: { id: true, reply: { select: { draftText: true } } },
  });
}

async function ensureDraftIfMissing(reviewId: string, hasDraft: boolean) {
  if (hasDraft) return false;
  await generateDraftForReview(reviewId);
  return true;
}

export async function syncClienteReviews(slugOrId: string): Promise<SyncResult> {
  const cliente = await getClienteWithGoogle(slugOrId);
  if (!cliente) throw new Error("Cliente no encontrado");

  const provider = resolveSyncProvider(cliente);
  const { reviews } = await fetchReviewsForCliente(cliente, 10);

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
        const hasDraft = Boolean(existing.reply?.draftText?.trim());
        if (await ensureDraftIfMissing(existing.id, hasDraft)) drafted++;
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
      await generateDraftForReview(review.id);
      drafted++;
    } catch (err) {
      console.error(`Gemini draft failed for new review ${review.id}:`, err);
    }
  }

  if (provider === "google" && cliente.googleConnection) {
    await prisma.googleConnection.update({
      where: { id: cliente.googleConnection.id },
      data: { lastSyncAt: new Date(), lastError: null },
    });
  }

  return { ok: true, provider, created, skipped, skippedAnswered, drafted };
}
