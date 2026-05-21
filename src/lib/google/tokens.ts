import type { GoogleConnection } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type TokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

async function exchangeToken(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Google token error ${res.status}: ${txt || res.statusText}`);
  }
  return res.json();
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    `${(process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "")}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth no configurado (CLIENT_ID / CLIENT_SECRET)");
  }

  return exchangeToken({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
}

export async function refreshAccessToken(
  connection: GoogleConnection
): Promise<string> {
  if (!connection.refreshToken) {
    throw new Error("No hay refresh token de Google");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;

  const data = await exchangeToken({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: connection.refreshToken,
    grant_type: "refresh_token",
  });

  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000)
    : null;

  await prisma.googleConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: data.access_token,
      tokenExpiresAt: expiresAt,
      status: "CONNECTED",
      lastError: null,
    },
  });

  return data.access_token;
}

/** Devuelve un access token válido, refrescando si hace falta. */
export async function getValidAccessToken(
  connection: GoogleConnection
): Promise<string> {
  if (!connection.accessToken) {
    if (!connection.refreshToken) throw new Error("Conexión Google sin tokens");
    return refreshAccessToken(connection);
  }

  const stillValid =
    connection.tokenExpiresAt &&
    connection.tokenExpiresAt.getTime() > Date.now() + 60_000;

  if (stillValid) return connection.accessToken;
  return refreshAccessToken(connection);
}
