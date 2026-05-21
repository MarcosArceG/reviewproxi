import { NextResponse } from "next/server";
import { getSlugFromRequest } from "@/lib/api/slug";
import {
  getClienteWithGoogle,
  getGooglePublicStatus,
  resolveSyncProvider,
} from "@/lib/reviews/provider";
import { isApifyConfigured } from "@/lib/reviews/apify-provider";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: slugParam } = await params;
  const slug = getSlugFromRequest(req, { slug: slugParam }, 2);
  if (!slug) {
    return NextResponse.json({ error: "slug no proporcionado" }, { status: 400 });
  }

  const cliente = await getClienteWithGoogle(slug);
  if (!cliente) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    slug: cliente.slug,
    syncProvider: resolveSyncProvider(cliente),
    apifyAvailable: isApifyConfigured() && Boolean(cliente.urlGoogle),
    google: getGooglePublicStatus(cliente.googleConnection),
  });
}
