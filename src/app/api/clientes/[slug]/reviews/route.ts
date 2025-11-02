import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const revalidate = 0;

function getSlugFromRequest(req: Request, params?: Record<string, any>) {
  let slug = params?.slug;
  if (Array.isArray(slug)) slug = slug[0];
  if (typeof slug === "string" && slug.trim()) return slug.trim();
  const { pathname } = new URL(req.url);
  const parts = pathname.replace(/\/+$/, "").split("/");
  return parts[parts.length - 2] || undefined; // .../clientes/[slug]/reviews
}

async function getClienteByIdOrSlug(value: string) {
  let c = await prisma.cliente.findUnique({ where: { id: value } });
  if (c) return c;
  return prisma.cliente.findUnique({ where: { slug: value } });
}

export async function GET(req: Request, context: { params?: Record<string, any> } = {}) {
  const slug = getSlugFromRequest(req, context.params);
  if (!slug) return NextResponse.json({ error: "slug no proporcionado" }, { status: 400 });

  const cliente = await getClienteByIdOrSlug(slug);
  if (!cliente) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

  const items = await prisma.review.findMany({
    where: { clienteId: cliente.id },
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
      reply: {
        select: { id: true, draftText: true, finalText: true, createdBy: true, sentAt: true },
      },
    },
  });

  return NextResponse.json({ items });
}
