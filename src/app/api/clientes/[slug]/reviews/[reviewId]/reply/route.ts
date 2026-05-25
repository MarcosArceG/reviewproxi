import { NextResponse } from "next/server";
import { isAuthError, requireClienteScopeApi } from "@/lib/auth/api";
import { getSlugFromRequest } from "@/lib/api/slug";
import { postReviewReply } from "@/lib/reviews/post-reply";

export const runtime = "nodejs";
export const revalidate = 0;

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

    const body = await req.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text : "";

    const result = await postReviewReply(slug, reviewId, text);
    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al responder";
    const status = message.includes("no encontrad") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
