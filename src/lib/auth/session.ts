import { auth, currentUser } from "@clerk/nextjs/server";
import type { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { isAdminEmail } from "@/lib/auth/admin-emails";
import { prisma } from "@/lib/prisma";

const clienteSelect = {
  id: true,
  slug: true,
  nombre: true,
  estado: true,
} as const;

export type AppUser = {
  id: string;
  clerkId: string;
  email: string;
  role: Role;
  clienteId: string | null;
  cliente: {
    id: string;
    slug: string;
    nombre: string;
    estado: "ACTIVO" | "PAUSADO";
  } | null;
};

function clerkRole(user: {
  publicMetadata?: Record<string, unknown>;
}): string | undefined {
  const role = user.publicMetadata?.role;
  return typeof role === "string" ? role : undefined;
}

async function upsertAdminUser(clerkId: string, email: string): Promise<AppUser> {
  const row = await prisma.user.upsert({
    where: { clerkId },
    create: { clerkId, email, role: "ADMIN" },
    update: { email, role: "ADMIN", clienteId: null },
    include: { cliente: { select: clienteSelect } },
  });
  return row;
}

/** Usuario de la app (DB + admins por email o metadata de Clerk). */
export async function getAppUser(): Promise<AppUser | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const existing = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: { cliente: { select: clienteSelect } },
  });
  if (existing) return existing;

  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const email =
    clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId
    )?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;

  if (!email) return null;

  if (clerkRole(clerkUser) === "ADMIN" || isAdminEmail(email)) {
    return upsertAdminUser(userId, email);
  }

  return null;
}

export function getHomePath(user: AppUser): string {
  if (user.role === "ADMIN") return "/admin";
  if (user.cliente?.slug) return `/c/${user.cliente.slug}`;
  return "/sin-acceso";
}

export async function requireAdmin(): Promise<AppUser> {
  const user = await getAppUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "ADMIN") {
    redirect(getHomePath(user));
  }
  return user;
}

/** Admin puede ver cualquier slug; el cliente solo el suyo. */
export async function requireClienteAccess(slug: string): Promise<AppUser> {
  const user = await getAppUser();
  if (!user) redirect("/sign-in");

  if (user.role === "ADMIN") return user;

  if (user.role === "CLIENT") {
    if (user.cliente?.slug === slug) return user;
    if (user.cliente?.slug) redirect(`/c/${user.cliente.slug}`);
    redirect("/sin-acceso");
  }

  redirect("/sin-acceso");
}
