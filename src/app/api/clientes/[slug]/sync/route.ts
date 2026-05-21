import { NextResponse } from "next/server";
import { getSlugFromRequest } from "@/lib/api/slug";
import { syncClienteReviews } from "@/lib/reviews/sync-reviews";

export const runtime = "nodejs";
export const revalidate = 0;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug: slugParam } = await params;
    const slug = getSlugFromRequest(req, { slug: slugParam }, 1);
    if (!slug) {
      return NextResponse.json({ error: "slug no proporcionado" }, { status: 400 });
    }

    const result = await syncClienteReviews(slug);
    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    console.error("SYNC error:", err);
    const message = err instanceof Error ? err.message : "Error al sincronizar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
