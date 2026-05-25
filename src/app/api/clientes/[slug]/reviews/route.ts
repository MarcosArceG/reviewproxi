import { NextResponse } from "next/server";
import { getSlugFromRequest } from "@/lib/api/slug";
import {
  automationExclusionReason,
  isEligibleForAutomation,
} from "@/lib/reviews/automation";
import { hasOwnerReplyInRaw } from "@/lib/reviews/owner-reply";
import { ensureDisplayDraftForReview } from "@/lib/reviews/ensure-display-draft";
import {
  canUseGoogleApi,
  getClienteWithGoogle,
} from "@/lib/reviews/provider";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const revalidate = 0;

type ReviewView = "pending" | "responded";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: slugParam } = await params;
  const slug = getSlugFromRequest(req, { slug: slugParam }, 1);
  if (!slug) {
    return NextResponse.json({ error: "slug no proporcionado" }, { status: 400 });
  }

  const url = new URL(req.url);
  const view = (url.searchParams.get("view") || "pending") as ReviewView;
  const mode = url.searchParams.get("mode") || "all";

  const cliente = await getClienteWithGoogle(slug);
  if (!cliente) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  const googleApi = canUseGoogleApi(cliente.googleConnection);
  const automation = await prisma.automation.findUnique({
    where: { clienteId: cliente.id },
  });

  if (view === "responded") {
    const rows = await prisma.review.findMany({
      where: { clienteId: cliente.id, status: "RESPONDIDA" },
      orderBy: { date: "desc" },
      take: 50,
      select: {
        id: true,
        authorName: true,
        authorPhotoUrl: true,
        text: true,
        stars: true,
        date: true,
        status: true,
        source: true,
        externalId: true,
        rawJson: true,
        reply: {
          select: {
            id: true,
            draftText: true,
            finalText: true,
            createdBy: true,
            sentAt: true,
            sentByAutomation: true,
          },
        },
      },
    });

    let items = rows
      .filter((r) => !hasOwnerReplyInRaw(r.rawJson) && r.reply?.sentAt)
      .map((r) => ({
        id: r.id,
        authorName: r.authorName,
        authorPhotoUrl: r.authorPhotoUrl,
        text: r.text,
        stars: r.stars,
        date: r.date,
        status: r.status,
        source: r.source,
        externalId: r.externalId,
        sentByAutomation: Boolean(r.reply?.sentByAutomation),
        responseText: r.reply?.finalText || r.reply?.draftText || "",
        sentAt: r.reply?.sentAt,
        reply: r.reply,
      }));

    if (mode === "auto") {
      items = items.filter((r) => r.sentByAutomation);
    } else if (mode === "manual") {
      items = items.filter((r) => !r.sentByAutomation);
    }

    return NextResponse.json({
      view,
      syncProvider: googleApi ? "google" : "apify",
      googleConnected: googleApi,
      automation: {
        enabled: automation?.enabled ?? false,
        minStars: automation?.minStars ?? 4,
        enabledAt: automation?.enabledAt?.toISOString() ?? null,
      },
      items: items.slice(0, 20),
    });
  }

  const rows = await prisma.review.findMany({
    where: {
      clienteId: cliente.id,
      status: { in: ["PENDIENTE", "LISTA"] },
    },
    orderBy: { date: "desc" },
    take: 30,
    select: {
      id: true,
      authorName: true,
      authorPhotoUrl: true,
      text: true,
      stars: true,
      date: true,
      status: true,
      source: true,
      externalId: true,
      rawJson: true,
      reply: {
        select: {
          id: true,
          draftText: true,
          finalText: true,
          createdBy: true,
          sentAt: true,
          sentByAutomation: true,
        },
      },
    },
  });

  const filtered = rows.filter((r) => !hasOwnerReplyInRaw(r.rawJson)).slice(0, 10);

  const items = await Promise.all(
    filtered.map(async (r) => {
      const display = await ensureDisplayDraftForReview(r);
      const eligibleForAutomation = isEligibleForAutomation(
        r.stars,
        r.date,
        automation
      );
      const exclusion = automationExclusionReason(r.stars, r.date, automation);
      return {
        id: r.id,
        authorName: r.authorName,
        authorPhotoUrl: r.authorPhotoUrl,
        text: r.text,
        stars: r.stars,
        date: r.date,
        status: r.status,
        source: r.source,
        externalId: r.externalId,
        hasAiDraft: display.hasAiDraft,
        requiresManualDraft: display.requiresManualDraft,
        isTemplateDraft: display.isTemplateDraft,
        suggestedDraftText: display.draftText,
        eligibleForAutomation,
        automationExclusion: exclusion,
        automationManualOnly: automation?.enabled && !eligibleForAutomation,
        reply: display.reply,
        canPostToGoogle:
          googleApi && r.source === "GOOGLE" && Boolean(r.externalId),
      };
    })
  );

  return NextResponse.json({
    view: "pending",
    syncProvider: googleApi ? "google" : "apify",
    googleConnected: googleApi,
    automation: {
      enabled: automation?.enabled ?? false,
      minStars: automation?.minStars ?? 4,
      enabledAt: automation?.enabledAt?.toISOString() ?? null,
    },
    items,
  });
}
