import { NextResponse } from "next/server";
import { isAuthError, requireClienteScopeApi } from "@/lib/auth/api";
import { getSlugFromRequest } from "@/lib/api/slug";
import { generateDraftForReview } from "@/lib/reviews/generate-draft";
import { getClienteWithGoogle } from "@/lib/reviews/provider";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string; reviewId: string }> }
) {
  try {
    const resolved = await params;
    const slug = getSlugFromRequest(req, { slug: resolved.slug }, 3);
    const reviewId = resolved.reviewId;

    if (!slug) {
      return NextResponse.json({ error: "slug no proporcionado" }, { status: 400 });
    }
    if (!reviewId) {
      return NextResponse.json({ error: "reviewId no proporcionado" }, { status: 400 });
    }

    const authResult = await requireClienteScopeApi(slug);
    if (isAuthError(authResult)) return authResult;

    const cliente = await getClienteWithGoogle(slug);
    if (!cliente) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    const review = await prisma.review.findFirst({
      where: { id: reviewId, clienteId: cliente.id, status: { in: ["PENDIENTE", "LISTA"] } },
    });
    if (!review) {
      return NextResponse.json({ error: "Reseña no encontrada" }, { status: 404 });
    }

    const result = await generateDraftForReview(reviewId);
    if (!result.ok) {
      return NextResponse.json(result, { status: 200 });
    }
    return NextResponse.json({ ok: true, draftText: result.draftText });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al generar borrador";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
