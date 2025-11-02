// src/app/api/clientes/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClerkClient } from "@clerk/backend"; // ⬅️ lo usamos solo dentro de POST

// --- Utils ---
function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

async function uniqueSlug(base: string) {
  let slug = slugify(base) || "cliente";
  let i = 1;
  while (true) {
    const exists = await prisma.cliente.findUnique({ where: { slug } });
    if (!exists) return slug;
    slug = `${slugify(base)}-${i++}`;
  }
}

// --- POST: crear cliente (Clerk + DB) ---
export async function POST(req: Request) {
  try {
    const { nombre, so, email, password, urlGoogle } = await req.json();

    if (!nombre || !email || !password || !urlGoogle) {
      return NextResponse.json({ error: "Faltan campos obligatorios." }, { status: 400 });
    }

    const slug = await uniqueSlug(nombre);

    const secret = process.env.CLERK_SECRET_KEY;
    if (!secret) {
      return NextResponse.json({ error: "Falta CLERK_SECRET_KEY en .env" }, { status: 500 });
    }

    // Instancia Clerk aquí (evita romper el GET si hay problema de env)
    const clerk = createClerkClient({ secretKey: secret });

    // 1) Crear usuario en Clerk
    const created = await clerk.users.createUser({
      emailAddress: [email],
      password,
      publicMetadata: { role: "CLIENT" },
    });

    // 2) Crear registros en DB
    const result = await prisma.$transaction(async (tx) => {
      const cliente = await tx.cliente.create({
        data: { nombre, slug, so: so || null, email, urlGoogle, estado: "ACTIVO" },
      });

      await tx.user.create({
        data: {
          clerkId: created.id,
          email,
          role: "CLIENT",
          clienteId: cliente.id,
        },
      });

      await tx.automation.create({
        data: { clienteId: cliente.id, enabled: false },
      });

      return { cliente };
    });

    return NextResponse.json(
      { ok: true, slug: result.cliente.slug, clienteId: result.cliente.id },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("❌ Error en POST /api/clientes:", err);
    // Asegura SIEMPRE JSON
    const message = err?.errors?.[0]?.message || err?.message || "No se pudo crear el cliente";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// --- GET: listado + búsqueda ---
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    const where = q
      ? {
          OR: [
            { nombre: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
            { so: { contains: q, mode: "insensitive" } },
          ],
        }
      : {};

    const items = await prisma.cliente.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ items }, { status: 200 });
  } catch (err: any) {
    console.error("❌ Error en GET /api/clientes:", err);
    return NextResponse.json(
      { error: err.message || "No se pudieron obtener los clientes" },
      { status: 500 }
    );
  }
}
