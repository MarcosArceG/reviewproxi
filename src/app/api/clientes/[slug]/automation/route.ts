import { NextResponse } from "next/server";
import { isAuthError, requireClienteScopeApi } from "@/lib/auth/api";
import { getSlugFromRequest } from "@/lib/api/slug";
import {
  automationSummaryLabel,
  formatAutomateSince,
  isEligibleForAutomation,
  normalizeMinStars,
} from "@/lib/reviews/automation";
import { getClienteWithGoogle } from "@/lib/reviews/provider";
import { hasOwnerReplyInRaw } from "@/lib/reviews/owner-reply";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

async function getReviewCounts(
  clienteId: string,
  automation: {
    enabled: boolean;
    minStars: number;
    enabledAt: Date | null;
  } | null
) {
  const rows = await prisma.review.findMany({
    where: { clienteId },
    select: {
      stars: true,
      status: true,
      date: true,
      rawJson: true,
      reply: { select: { sentByAutomation: true, sentAt: true } },
    },
  });

  let pending = 0;
  let respondedManual = 0;
  let respondedAuto = 0;
  let pendingEligible = 0;
  let pendingManualOnly = 0;
  let pendingHistorical = 0;

  for (const r of rows) {
    if (hasOwnerReplyInRaw(r.rawJson)) continue;

    if (r.status === "RESPONDIDA" && r.reply?.sentAt) {
      if (r.reply.sentByAutomation) respondedAuto++;
      else respondedManual++;
      continue;
    }

    if (r.status === "PENDIENTE" || r.status === "LISTA") {
      pending++;
      if (!automation?.enabled || !automation.enabledAt) continue;

      if (r.date < automation.enabledAt) {
        pendingHistorical++;
        continue;
      }
      if (isEligibleForAutomation(r.stars, r.date, automation)) {
        pendingEligible++;
      } else {
        pendingManualOnly++;
      }
    }
  }

  return {
    pending,
    respondedManual,
    respondedAuto,
    pendingEligible,
    pendingManualOnly,
    pendingHistorical,
  };
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

  const authResult = await requireClienteScopeApi(slug);
  if (isAuthError(authResult)) return authResult;

  const cliente = await getClienteWithGoogle(slug);
  if (!cliente) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  const automation = await prisma.automation.findUnique({
    where: { clienteId: cliente.id },
  });

  const minStars = automation?.minStars ?? 4;
  const counts = await getReviewCounts(cliente.id, automation);

  return NextResponse.json({
    enabled: automation?.enabled ?? false,
    minStars,
    enabledAt: automation?.enabledAt?.toISOString() ?? null,
    automateSinceLabel: formatAutomateSince(automation?.enabledAt),
    summary: automationSummaryLabel(minStars),
    counts,
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

  const authResult = await requireClienteScopeApi(slug);
  if (isAuthError(authResult)) return authResult;

  const cliente = await getClienteWithGoogle(slug);
  if (!cliente) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const enabled = Boolean(body.enabled);
  const minStars = normalizeMinStars(body.minStars ?? 4);

  const existing = await prisma.automation.findUnique({
    where: { clienteId: cliente.id },
  });

  const enabledAt = !enabled
    ? null
    : existing?.enabled && existing.enabledAt
      ? existing.enabledAt
      : new Date();

  const automation = await prisma.automation.upsert({
    where: { clienteId: cliente.id },
    create: {
      clienteId: cliente.id,
      enabled,
      minStars,
      enabledAt,
    },
    update: {
      enabled,
      minStars,
      enabledAt,
    },
  });

  const counts = await getReviewCounts(cliente.id, automation);

  return NextResponse.json({
    enabled: automation.enabled,
    minStars: automation.minStars,
    enabledAt: automation.enabledAt?.toISOString() ?? null,
    automateSinceLabel: formatAutomateSince(automation.enabledAt),
    summary: automationSummaryLabel(automation.minStars),
    counts,
  });
}
