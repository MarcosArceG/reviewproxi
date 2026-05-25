import { shouldSkipAutoDraft } from "@/lib/ai/review-draft";
import { prisma } from "@/lib/prisma";
import { generateDraftForReview } from "@/lib/reviews/generate-draft";
import { hasOwnerReplyInRaw } from "@/lib/reviews/owner-reply";
import { postReviewReply } from "@/lib/reviews/post-reply";
import { syncClienteReviews } from "@/lib/reviews/sync-reviews";
import { isEligibleForAutomation } from "@/lib/reviews/automation";

const MAX_REPLIES_PER_CLIENT = 15;

export type ClienteAutomationResult = {
  slug: string;
  clienteId: string;
  sync?: { created: number; drafted: number; error?: string };
  replied: number;
  skipped: number;
  errors: string[];
};

export type DailyAutomationResult = {
  ok: true;
  ranAt: string;
  clientesProcessed: number;
  totalReplied: number;
  results: ClienteAutomationResult[];
};

export async function runDailyAutomation(options?: {
  syncFirst?: boolean;
  maxClientes?: number;
}): Promise<DailyAutomationResult> {
  const syncFirst = options?.syncFirst !== false;
  const maxClientes = options?.maxClientes ?? 50;

  const clientes = await prisma.cliente.findMany({
    where: {
      estado: "ACTIVO",
      automation: { is: { enabled: true } }, // relation filter
    },
    select: {
      id: true,
      slug: true,
      automation: { select: { minStars: true, enabled: true } },
    },
    take: maxClientes,
    orderBy: { updatedAt: "asc" },
  });

  const results: ClienteAutomationResult[] = [];
  let totalReplied = 0;

  for (const cliente of clientes) {
    const row: ClienteAutomationResult = {
      slug: cliente.slug,
      clienteId: cliente.id,
      replied: 0,
      skipped: 0,
      errors: [],
    };

    try {
      if (syncFirst) {
        try {
          const sync = await syncClienteReviews(cliente.slug);
          row.sync = {
            created: sync.created,
            drafted: sync.drafted,
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Error en sync";
          row.sync = { created: 0, drafted: 0, error: msg };
          row.errors.push(`Sync: ${msg}`);
        }
      }

      const reviews = await prisma.review.findMany({
        where: {
          clienteId: cliente.id,
          status: { in: ["PENDIENTE", "LISTA"] },
        },
        orderBy: { date: "desc" },
        take: 30,
        select: {
          id: true,
          stars: true,
          text: true,
          rawJson: true,
          reply: { select: { draftText: true } },
        },
      });

      let repliesThisClient = 0;

      for (const review of reviews) {
        if (repliesThisClient >= MAX_REPLIES_PER_CLIENT) break;
        if (hasOwnerReplyInRaw(review.rawJson)) continue;
        if (shouldSkipAutoDraft(review.stars, review.text)) {
          row.skipped++;
          continue;
        }
        if (!isEligibleForAutomation(review.stars, cliente.automation)) {
          row.skipped++;
          continue;
        }

        let draftText = review.reply?.draftText?.trim() || "";
        if (!draftText) {
          try {
            const gen = await generateDraftForReview(review.id);
            if (!gen.ok) {
              row.skipped++;
              continue;
            }
            draftText = gen.draftText;
          } catch (err: unknown) {
            row.errors.push(
              `Draft ${review.id}: ${err instanceof Error ? err.message : "error"}`
            );
            continue;
          }
        }

        try {
          await postReviewReply(cliente.slug, review.id, draftText, {
            sentByAutomation: true,
          });
          row.replied++;
          repliesThisClient++;
          totalReplied++;
        } catch (err: unknown) {
          row.errors.push(
            `Reply ${review.id}: ${err instanceof Error ? err.message : "error"}`
          );
        }
      }
    } catch (err: unknown) {
      row.errors.push(err instanceof Error ? err.message : "Error en cliente");
    }

    results.push(row);
  }

  return {
    ok: true,
    ranAt: new Date().toISOString(),
    clientesProcessed: results.length,
    totalReplied,
    results,
  };
}
