import { prisma } from "@/lib/prisma";
import {
  resolveReviewDraftText,
  shouldSkipAutoDraft,
} from "@/lib/ai/review-draft";

export type GenerateDraftResult =
  | { ok: true; draftText: string }
  | { ok: false; skipped: true; reason: string };

async function clearAiReply(reviewId: string, replyId?: string) {
  if (replyId) {
    await prisma.reply.delete({ where: { id: replyId } });
  }
  await prisma.review.update({
    where: { id: reviewId },
    data: { status: "PENDIENTE" },
  });
}

export async function generateDraftForReview(
  reviewId: string
): Promise<GenerateDraftResult> {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: {
      id: true,
      authorName: true,
      text: true,
      stars: true,
      reply: { select: { id: true } },
    },
  });

  if (!review) throw new Error("Reseña no encontrada");

  if (shouldSkipAutoDraft(review.stars, review.text)) {
    await clearAiReply(review.id, review.reply?.id);
    return {
      ok: false,
      skipped: true,
      reason:
        "Reseña de 3 estrellas o menos sin comentario: redacta la respuesta manualmente.",
    };
  }

  const draftText = await resolveReviewDraftText({
    authorName: review.authorName,
    text: review.text,
    stars: review.stars,
  });

  if (!draftText) {
    throw new Error("No se pudo generar el borrador");
  }

  if (review.reply) {
    await prisma.reply.update({
      where: { id: review.reply.id },
      data: { draftText, createdBy: "AI" },
    });
  } else {
    await prisma.reply.create({
      data: {
        reviewId: review.id,
        draftText,
        createdBy: "AI",
      },
    });
  }

  await prisma.review.update({
    where: { id: review.id },
    data: { status: "LISTA" },
  });

  return { ok: true, draftText };
}
