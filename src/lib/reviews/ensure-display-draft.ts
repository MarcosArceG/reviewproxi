import { prisma } from "@/lib/prisma";
import {
  buildRatingOnlyThankYouDraft,
  shouldReplaceRatingOnlyDraft,
  shouldSkipAutoDraft,
  usesRatingOnlyTemplate,
} from "@/lib/ai/review-draft";

type ReviewRow = {
  id: string;
  authorName: string | null;
  text: string;
  stars: number;
  reply: {
    id: string;
    draftText: string;
    finalText: string | null;
    createdBy: "AI" | "USER";
    sentAt: Date | null;
  } | null;
};

export type DisplayDraft = {
  draftText: string;
  hasAiDraft: boolean;
  requiresManualDraft: boolean;
  isTemplateDraft: boolean;
  reply: ReviewRow["reply"];
};

export async function ensureDisplayDraftForReview(
  row: ReviewRow
): Promise<DisplayDraft> {
  const requiresManualDraft = shouldSkipAutoDraft(row.stars, row.text);
  const storedDraft = row.reply?.draftText?.trim() || "";

  if (requiresManualDraft) {
    return {
      draftText: storedDraft,
      hasAiDraft: false,
      requiresManualDraft: true,
      isTemplateDraft: false,
      reply: row.reply,
    };
  }

  if (
    usesRatingOnlyTemplate(row.stars, row.text) &&
    shouldReplaceRatingOnlyDraft(
      storedDraft,
      row.authorName,
      row.stars,
      row.text
    )
  ) {
    const template = buildRatingOnlyThankYouDraft(row.authorName, row.stars)!;

    if (row.reply) {
      const updated = await prisma.reply.update({
        where: { id: row.reply.id },
        data: { draftText: template, createdBy: "AI" },
      });
      await prisma.review.update({
        where: { id: row.id },
        data: { status: "LISTA" },
      });
      return {
        draftText: template,
        hasAiDraft: true,
        requiresManualDraft: false,
        isTemplateDraft: true,
        reply: { ...row.reply, draftText: updated.draftText, createdBy: "AI" },
      };
    }

    const created = await prisma.reply.create({
      data: {
        reviewId: row.id,
        draftText: template,
        createdBy: "AI",
      },
    });
    await prisma.review.update({
      where: { id: row.id },
      data: { status: "LISTA" },
    });
    return {
      draftText: template,
      hasAiDraft: true,
      requiresManualDraft: false,
      isTemplateDraft: true,
      reply: {
        id: created.id,
        draftText: created.draftText,
        finalText: created.finalText,
        createdBy: created.createdBy,
        sentAt: created.sentAt,
      },
    };
  }

  return {
    draftText: storedDraft,
    hasAiDraft: storedDraft.length > 0,
    requiresManualDraft: false,
    isTemplateDraft: usesRatingOnlyTemplate(row.stars, row.text),
    reply: row.reply,
  };
}
