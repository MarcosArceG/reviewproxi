import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { getGoogleRedirectUri, GOOGLE_BUSINESS_SCOPE } from "@/lib/google/config";

type OAuthStatePayload = {
  slug: string;
  nonce: string;
  ts: number;
};

function stateSecret(): string {
  return (
    process.env.GOOGLE_OAUTH_STATE_SECRET ||
    process.env.CLERK_SECRET_KEY ||
    "dev-insecure-oauth-state"
  );
}

export function encodeOAuthState(slug: string): string {
  const payload: OAuthStatePayload = {
    slug,
    nonce: randomBytes(16).toString("hex"),
    ts: Date.now(),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function decodeOAuthState(state: string): OAuthStatePayload | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;

  const expected = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as OAuthStatePayload;
    if (!payload.slug || !payload.ts) return null;
    if (Date.now() - payload.ts > 30 * 60 * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export function buildGoogleAuthUrl(slug: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const redirectUri = getGoogleRedirectUri();
  const state = encodeOAuthState(slug);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_BUSINESS_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}
