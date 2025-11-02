// src/components/AppHeader.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { UserButton, useUser } from "@clerk/nextjs";

type Props = {
  /** Opcional: queda como aria-label/visually-hidden, no se muestra */
  title?: string;
};

export default function AppHeader({ title }: Props) {
  const { user } = useUser();

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b">
      <div className="mx-auto max-w-6xl flex items-center justify-between py-4 px-4 sm:px-6">
        {/* Logo siempre visible */}
        <Link href="/" className="flex items-center gap-3" aria-label={title || "Inicio"}>
          <Image
            src="/logo.png"
            alt="Logo"
            width={140}
            height={32}
            priority
            className="h-8 w-auto object-contain"
          />
          {/* Visually hidden title for a11y/SEO */}
          {title ? (
            <span className="sr-only">{title}</span>
          ) : null}
        </Link>

        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">
            {user?.firstName ? `Hola, ${user.firstName}` : "Hola"}
          </span>
          <UserButton />
        </div>
      </div>
    </header>
  );
}
