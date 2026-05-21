import { prisma } from "@/lib/prisma";
import { resolveDefaultLocation } from "@/lib/google/business-api";
import type { TokenResponse } from "@/lib/google/tokens";

export async function upsertGoogleConnectionFromOAuth(
  clienteId: string,
  tokens: TokenResponse
) {
  const accessToken = tokens.access_token;
  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000)
    : null;

  const { accountName, locationName, placeId } =
    await resolveDefaultLocation(accessToken);

  return prisma.googleConnection.upsert({
    where: { clienteId },
    create: {
      clienteId,
      status: "CONNECTED",
      googleAccountId: accountName,
      locationName,
      placeId,
      accessToken,
      refreshToken: tokens.refresh_token ?? null,
      tokenExpiresAt: expiresAt,
      scopes: tokens.scope ?? null,
      connectedAt: new Date(),
      lastError: null,
    },
    update: {
      status: "CONNECTED",
      googleAccountId: accountName,
      locationName,
      placeId,
      accessToken,
      refreshToken: tokens.refresh_token ?? undefined,
      tokenExpiresAt: expiresAt,
      scopes: tokens.scope ?? null,
      connectedAt: new Date(),
      lastError: null,
    },
  });
}
