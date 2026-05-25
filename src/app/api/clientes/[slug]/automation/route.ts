import { NextResponse } from "next/server";
import { getSlugFromRequest } from "@/lib/api/slug";
import {
  automationSummaryLabel,
  normalizeMinStars,
} from "@/lib/reviews/automation";
import { getClienteWithGoogle } from "@/lib/reviews/provider";
import { hasOwnerReplyInRaw } from "@/lib/reviews/owner-reply";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

async function getReviewCounts(clienteId: string) {
  const rows = await prisma.review.findMany({
    where: { clienteId },
    select: {
      stars: true,
      status: true,
      rawJson: true,
      reply: { select: { sentByAutomation: true, sentAt: true } },
    },
  });

  let pending = 0;
  let respondedManual = 0;
  let respondedAuto = 0;

  for (const r of rows) {
    if (hasOwnerReplyInRaw(r.rawJson)) continue;
    if (r.status === "RESPONDIDA" && r.reply?.sentAt) {
      if (r.reply.sentByAutomation) respondedAuto++;
      else respondedManual++;
      continue;
    }
    if (r.status === "PENDIENTE" || r.status === "LISTA") {
      pending++;
    }
  }

  return { pending, respondedManual, respondedAuto };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: slugParam } = await params;
  const slug = getSlugFromRequest(req, { slug: slugParam }, 1);
  if (!slug) {
    return NextResponse.json({ error: "slug no proporcionado" }, { status: 400 });
  }

  const cliente = await getClienteWithGoogle(slug);
  if (!cliente) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  const automation = await prisma.automation.findUnique({
    where: { clienteId: cliente.id },
  });

  const minStars = automation?.minStars ?? 4;
  const counts = await getReviewCounts(cliente.id);

  const pendingRows = await prisma.review.findMany({
    where: { clienteId: cliente.id, status: { in: ["PENDIENTE", "LISTA"] } },
    select: { stars: true, rawJson: true },
  });

  let pendingEligible = 0;
  let pendingManualOnly = 0;
  for (const r of pendingRows) {
    if (hasOwnerReplyInRaw(r.rawJson)) continue;
    if (r.stars >= minStars) pendingEligible++;
    else pendingManualOnly++;
  }

  return NextResponse.json({
    enabled: automation?.enabled ?? false,
    minStars,
    enabledAt: automation?.enabledAt?.toISOString() ?? null,
    summary: automationSummaryLabel(minStars),
    counts: {
      ...counts,
      pendingEligible,
      pendingManualOnly,
    },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: slugParam } = await params;
  const slug = getSlugFromRequest(req, { slug: slugParam }, 1);
  if (!slug) {
    return NextResponse.json({ error: "slug no proporcionado" }, { status: 400 });
  }

  const cliente = await getClienteWithGoogle(slug);
  if (!cliente) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const enabled = Boolean(body.enabled);
  const minStars = normalizeMinStars(body.minStars ?? 4);

  const automation = await prisma.automation.upsert({
    where: { clienteId: cliente.id },
    create: {
      clienteId: cliente.id,
      enabled,
      minStars,
      enabledAt: enabled ? new Date() : null,
    },
    update: {
      enabled,
      minStars,
      enabledAt: enabled ? new Date() : null,
    },
  });

  return NextResponse.json({
    enabled: automation.enabled,
    minStars: automation.minStars,
    enabledAt: automation.enabledAt?.toISOString() ?? null,
    summary: automationSummaryLabel(automation.minStars),
  });
}
