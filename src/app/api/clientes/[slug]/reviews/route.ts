import { NextResponse } from "next/server";
import { getSlugFromRequest } from "@/lib/api/slug";
import { hasOwnerReplyInRaw } from "@/lib/reviews/owner-reply";
import {
  canUseGoogleApi,
  getClienteWithGoogle,
} from "@/lib/reviews/provider";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const revalidate = 0;

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

  const googleApi = canUseGoogleApi(cliente.googleConnection);

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
        },
      },
    },
  });

  const items = rows
    .filter((r) => !hasOwnerReplyInRaw(r.rawJson))
    .slice(0, 10)
    .map((r) => {
      const draftText = r.reply?.draftText?.trim() || "";
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
        hasAiDraft: draftText.length > 0,
        reply: r.reply,
        canPostToGoogle:
          googleApi && r.source === "GOOGLE" && Boolean(r.externalId),
      };
    });

  return NextResponse.json({
    syncProvider: googleApi ? "google" : "apify",
    googleConnected: googleApi,
    items,
  });
}
