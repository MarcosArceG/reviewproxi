import { NextResponse } from "next/server";
import { isAuthError, requireClienteScopeApi } from "@/lib/auth/api";
import { getSlugFromRequest } from "@/lib/api/slug";
import { buildGoogleAuthUrl } from "@/lib/google/oauth-state";
import { isGoogleOAuthConfigured } from "@/lib/google/config";
import { getClienteWithGoogle } from "@/lib/reviews/provider";

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

  const authResult = await requireClienteScopeApi(slug);
  if (isAuthError(authResult)) return authResult;

  const cliente = await getClienteWithGoogle(slug);
  if (!cliente) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json({
      configured: false,
      message:
        "Google OAuth no está configurado. Usa sincronización demo (Apify) mientras tanto.",
    });
  }

  const authUrl = buildGoogleAuthUrl(cliente.slug);
  return NextResponse.json({
    configured: true,
    authUrl,
    slug: cliente.slug,
  });
}
