import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClerkClient } from "@clerk/backend";
import { getSlugFromRequest } from "@/lib/api/slug";
import {
  getClienteWithGoogle,
  getGooglePublicStatus,
  resolveSyncProvider,
} from "@/lib/reviews/provider";

export const runtime = "nodejs";
export const revalidate = 0;

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

/* ------------ GET ------------ */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: slugParam } = await params;
  const slug = getSlugFromRequest(req, { slug: slugParam });
  if (!slug) return NextResponse.json({ error: "slug no proporcionado" }, { status: 400 });

  const cliente = await getClienteWithGoogle(slug);
  if (!cliente) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

  const { googleConnection, ...rest } = cliente;
  return NextResponse.json({
    ...rest,
    syncProvider: resolveSyncProvider(cliente),
    google: getGooglePublicStatus(googleConnection),
  });
}

/* ------------ PATCH ------------ */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: slugParam } = await params;
  const slug = getSlugFromRequest(req, { slug: slugParam });
  if (!slug) return NextResponse.json({ error: "slug no proporcionado" }, { status: 400 });

  const data = await req.json();
  const cliente = await getClienteWithGoogle(slug);
  if (!cliente) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

  const updated = await prisma.cliente.update({ where: { id: cliente.id }, data });
  return NextResponse.json(updated);
}

/* ------------ DELETE (DB + Clerk) ------------ */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: slugParam } = await params;
  const slug = getSlugFromRequest(req, { slug: slugParam });
  if (!slug) return NextResponse.json({ error: "slug no proporcionado" }, { status: 400 });

  const cliente = await getClienteWithGoogle(slug);
  if (!cliente) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

  // 1) Obtener usuarios vinculados (clerkId) ANTES de borrar en DB
  const users = await prisma.user.findMany({
    where: { clienteId: cliente.id },
    select: { id: true, clerkId: true, email: true },
  });

  // 2) Intentar borrar en Clerk (no bloquea si alguno falla)
  let clerkResults: Array<{ clerkId: string; ok: boolean; error?: string }> = [];
  if (process.env.CLERK_SECRET_KEY) {
    const deletions = await Promise.allSettled(
      users
        .filter(u => !!u.clerkId)
        .map(u =>
          clerk.users
            .deleteUser(u.clerkId)
            .then(() => ({ clerkId: u.clerkId, ok: true as const }))
            .catch((e: any) => ({
              clerkId: u.clerkId,
              ok: false as const,
              error: e?.errors?.[0]?.message || e?.message || "Error eliminando en Clerk",
            }))
        )
    );

    clerkResults = deletions.map((res, idx) =>
      res.status === "fulfilled"
        ? res.value
        : {
            clerkId: users[idx]?.clerkId || "desconocido",
            ok: false,
            error:
              (res as PromiseRejectedResult).reason?.message ||
              (res as PromiseRejectedResult).reason?.errors?.[0]?.message ||
              "Error eliminando en Clerk",
          }
    );
  }

  // 3) Borrar en DB (dependencias → cliente) en transacción
  try {
    await prisma.$transaction(async (tx) => {
      const reviewIds = (
        await tx.review.findMany({
          where: { clienteId: cliente.id },
          select: { id: true },
        })
      ).map((r) => r.id);

      if (reviewIds.length) {
        await tx.reply.deleteMany({ where: { reviewId: { in: reviewIds } } });
        await tx.review.deleteMany({ where: { id: { in: reviewIds } } });
      }

      await tx.automation.deleteMany({ where: { clienteId: cliente.id } });
      await tx.googleConnection.deleteMany({ where: { clienteId: cliente.id } });
      await tx.user.deleteMany({ where: { clienteId: cliente.id } });
      await tx.cliente.delete({ where: { id: cliente.id } });
    });

    return NextResponse.json(
      {
        ok: true,
        deleted: slug,
        clerk: clerkResults,
      },
      { status: 200 }
    );
  } catch (error: any) {
    // Si algo falla en DB, devuelve detalle y resultados de Clerk por transparencia
    console.error("DELETE /api/clientes/[slug] error:", error);
    return NextResponse.json(
      {
        error: error?.message || "Error al eliminar en DB",
        clerk: clerkResults,
      },
      { status: 500 }
    );
  }
}
