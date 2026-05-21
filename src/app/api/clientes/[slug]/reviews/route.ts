import { NextResponse } from "next/server";
import { getSlugFromRequest } from "@/lib/api/slug";
import {
  canUseGoogleApi,
  getClienteWithGoogle,
} from "@/lib/reviews/provider";

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

  const { prisma } = await import("@/lib/prisma");
  const cliente = await getClienteWithGoogle(slug);
  if (!cliente) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  const googleApi = canUseGoogleApi(cliente.googleConnection);

  const items = await prisma.review.findMany({
    where: {
      clienteId: cliente.id,
      status: { in: ["PENDIENTE", "LISTA"] },
    },
    orderBy: { date: "desc" },
    take: 10,
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

  return NextResponse.json({
    syncProvider: googleApi ? "google" : "apify",
    googleConnected: googleApi,
    items: items.map((r) => ({
      ...r,
      canPostToGoogle:
        googleApi && r.source === "GOOGLE" && Boolean(r.externalId),
    })),
  });
}
