import { prisma } from "@/lib/prisma";
import {
  buildReviewDraftPrompt,
  generateReviewDraft,
} from "@/lib/ai/review-draft";

export async function generateDraftForReview(reviewId: string): Promise<string> {
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

  const prompt = buildReviewDraftPrompt({
    authorName: review.authorName,
    text: review.text,
    stars: review.stars,
  });
  const draftText = await generateReviewDraft(prompt);
  if (!draftText.trim()) {
    throw new Error("Gemini no devolvió texto para el borrador");
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

  return draftText;
}
