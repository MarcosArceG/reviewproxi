"use client";

import Image from "next/image";
import Link from "next/link";
import { UserButton, useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";

type Props = {
  /** Opcional: queda como aria-label/visually-hidden, no se muestra */
  title?: string;
};

type MeResponse = {
  homePath: string;
  role: "ADMIN" | "CLIENT";
  clienteNombre?: string | null;
};

export default function AppHeader({ title }: Props) {
  const { user, isLoaded } = useUser();
  const [homePath, setHomePath] = useState("/");
  const [roleLabel, setRoleLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !user) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (!res.ok) return;
        const data: MeResponse = await res.json();
        if (cancelled) return;
        setHomePath(data.homePath || "/");
        if (data.role === "ADMIN") setRoleLabel("Administración");
        else if (data.clienteNombre) setRoleLabel(data.clienteNombre);
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, user?.id]);

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b">
      <div className="mx-auto max-w-6xl flex items-center justify-between py-4 px-4 sm:px-6">
        <Link href={homePath} className="flex items-center gap-3" aria-label={title || "Inicio"}>
          <Image
            src="/logo.png"
            alt="Logo"
            width={140}
            height={32}
            priority
            className="h-8 w-auto object-contain"
          />
          {title ? <span className="sr-only">{title}</span> : null}
        </Link>

        <div className="flex items-center gap-3">
          {roleLabel && (
            <span className="hidden sm:inline text-xs text-slate-500 border border-slate-200 rounded-full px-2 py-0.5">
              {roleLabel}
            </span>
          )}
          <span className="text-sm text-slate-600">
            {user?.firstName ? `Hola, ${user.firstName}` : "Hola"}
          </span>
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </div>
    </header>
  );
}
