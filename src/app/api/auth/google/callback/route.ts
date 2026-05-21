import { NextResponse } from "next/server";
import { decodeOAuthState } from "@/lib/google/oauth-state";
import { exchangeCodeForTokens } from "@/lib/google/tokens";
import { upsertGoogleConnectionFromOAuth } from "@/lib/google/connection";
import { getClienteWithGoogle } from "@/lib/reviews/provider";
import { getAppUrl } from "@/lib/google/config";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const appUrl = getAppUrl();

  if (oauthError) {
    return NextResponse.redirect(
      `${appUrl}/admin/clientes?google_error=${encodeURIComponent(oauthError)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/?google_error=missing_params`);
  }

  const payload = decodeOAuthState(state);
  if (!payload?.slug) {
    return NextResponse.redirect(`${appUrl}/?google_error=invalid_state`);
  }

  const cliente = await getClienteWithGoogle(payload.slug);
  if (!cliente) {
    return NextResponse.redirect(`${appUrl}/?google_error=cliente_not_found`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    await upsertGoogleConnectionFromOAuth(cliente.id, tokens);

    // Primera sync opcional tras conectar
    try {
      const { syncClienteReviews } = await import("@/lib/reviews/sync-reviews");
      await syncClienteReviews(cliente.slug);
    } catch (syncErr) {
      console.warn("Post-OAuth sync skipped:", syncErr);
      await prisma.googleConnection.update({
        where: { clienteId: cliente.id },
        data: {
          lastError:
            syncErr instanceof Error
              ? syncErr.message
              : "Conectado; la primera sincronización falló",
        },
      });
    }

    return NextResponse.redirect(
      `${appUrl}/c/${cliente.slug}/reviews?google_connected=1`
    );
  } catch (err: unknown) {
    console.error("Google OAuth callback error:", err);
    const msg = err instanceof Error ? err.message : "oauth_failed";
    return NextResponse.redirect(
      `${appUrl}/c/${cliente.slug}?google_error=${encodeURIComponent(msg)}`
    );
  }
}
