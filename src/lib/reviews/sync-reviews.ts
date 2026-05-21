import { prisma } from "@/lib/prisma";
import {
  buildReviewDraftPrompt,
  generateReviewDraft,
} from "@/lib/ai/review-draft";
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
      select: { id: true },
    });
  }

  return prisma.review.findFirst({
    where: { clienteId, text: item.text, date: item.date },
    select: { id: true },
  });
}

export async function syncClienteReviews(slugOrId: string): Promise<SyncResult> {
  const cliente = await getClienteWithGoogle(slugOrId);
  if (!cliente) throw new Error("Cliente no encontrado");

  const provider = resolveSyncProvider(cliente);
  const { reviews } = await fetchReviewsForCliente(cliente, 10);

  let created = 0;
  let skipped = 0;
  let drafted = 0;

  for (const item of reviews) {
    const existing = await findExistingReview(cliente.id, item);
    if (existing) {
      skipped++;
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
      select: { id: true, text: true, stars: true, authorName: true },
    });
    created++;

    const prompt = buildReviewDraftPrompt({
      authorName: review.authorName,
      text: review.text,
      stars: review.stars,
    });
    const draftText = await generateReviewDraft(prompt);

    await prisma.reply.create({
      data: {
        reviewId: review.id,
        draftText,
        createdBy: "AI",
      },
    });
    drafted++;
  }

  if (provider === "google" && cliente.googleConnection) {
    await prisma.googleConnection.update({
      where: { id: cliente.googleConnection.id },
      data: { lastSyncAt: new Date(), lastError: null },
    });
  }

  return { ok: true, provider, created, skipped, drafted };
}
