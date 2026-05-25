import { prisma } from "@/lib/prisma";
import { postReviewReplyOnGoogle } from "@/lib/google/business-api";
import {
  canUseGoogleApi,
  getClienteWithGoogle,
} from "@/lib/reviews/provider";
import type { PostReplyResult } from "@/lib/reviews/types";

export async function postReviewReply(
  slugOrId: string,
  reviewId: string,
  text: string,
  options?: { sentByAutomation?: boolean }
): Promise<PostReplyResult> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("El texto de la respuesta es obligatorio");

  const cliente = await getClienteWithGoogle(slugOrId);
  if (!cliente) throw new Error("Cliente no encontrado");

  const review = await prisma.review.findFirst({
    where: { id: reviewId, clienteId: cliente.id },
    include: { reply: true },
  });
  if (!review) throw new Error("Reseña no encontrada");
  if (review.status === "RESPONDIDA") {
    throw new Error("Esta reseña ya fue respondida");
  }

  const googleReady =
    canUseGoogleApi(cliente.googleConnection) &&
    review.source === "GOOGLE" &&
    Boolean(review.externalId);

  let postedToGoogle = false;
  let message: string | undefined;

  if (googleReady && cliente.googleConnection && review.externalId) {
    try {
      await postReviewReplyOnGoogle(
        cliente.googleConnection,
        review.externalId,
        trimmed
      );
      postedToGoogle = true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al publicar en Google";
      await prisma.googleConnection.update({
        where: { id: cliente.googleConnection.id },
        data: { lastError: msg },
      });
      throw new Error(msg);
    }
  } else if (review.source === "GOOGLE" && !googleReady) {
    message =
      "Respuesta guardada localmente. Conecta Google Business para publicar en Maps.";
  } else {
    message =
      "Respuesta guardada (modo demo). Conecta Google Business para publicar en Maps.";
  }

  const now = new Date();
  const sentByAutomation = Boolean(options?.sentByAutomation);
  const createdBy = sentByAutomation ? "AI" : "USER";

  if (review.reply) {
    await prisma.reply.update({
      where: { id: review.reply.id },
      data: {
        finalText: trimmed,
        draftText: trimmed,
        createdBy,
        sentAt: now,
        sentByAutomation,
      },
    });
  } else {
    await prisma.reply.create({
      data: {
        reviewId: review.id,
        draftText: trimmed,
        finalText: trimmed,
        createdBy,
        sentAt: now,
        sentByAutomation,
      },
    });
  }

  await prisma.review.update({
    where: { id: review.id },
    data: { status: "RESPONDIDA" },
  });

  return {
    ok: true,
    postedToGoogle,
    reviewId: review.id,
    message,
  };
}
