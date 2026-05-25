import { NextResponse } from "next/server";
import { getAppUser, type AppUser } from "@/lib/auth/session";

export function jsonUnauthorized() {
  return NextResponse.json({ error: "No autenticado" }, { status: 401 });
}

export function jsonForbidden() {
  return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
}

export function isAuthError(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

export async function requireAdminApi(): Promise<AppUser | NextResponse> {
  const user = await getAppUser();
  if (!user) return jsonUnauthorized();
  if (user.role !== "ADMIN") return jsonForbidden();
  return user;
}

export async function requireClienteScopeApi(
  slug: string
): Promise<AppUser | NextResponse> {
  const user = await getAppUser();
  if (!user) return jsonUnauthorized();
  if (user.role === "ADMIN") return user;
  if (user.role === "CLIENT" && user.cliente?.slug === slug) return user;
  return jsonForbidden();
}
