import { NextResponse } from "next/server";
import { getAppUser, getHomePath } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET() {
  const user = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  return NextResponse.json({
    role: user.role,
    email: user.email,
    clienteSlug: user.cliente?.slug ?? null,
    clienteNombre: user.cliente?.nombre ?? null,
    homePath: getHomePath(user),
  });
}
