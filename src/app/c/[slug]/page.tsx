// src/app/c/[slug]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { Globe } from "lucide-react";

type Cliente = {
  id: string;
  nombre: string;
  slug: string;
  estado: "ACTIVO" | "PAUSADO";
  urlGoogle: string | null;
};

export default function ClientePanelPage() {
  const pathname = usePathname();

  // Deriva el slug del pathname: /c/<slug>
  const slug = useMemo(() => {
    if (!pathname) return "";
    const clean = pathname.replace(/\/+$/, "");
    const parts = clean.split("/");
    return parts[parts.length - 1] || "";
  }, [pathname]);

  const [loading, setLoading] = useState(true);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError(null);
      setCliente(null);
      try {
        if (!slug) throw new Error("No se recibió slug en la ruta.");
        const res = await fetch(`/api/clientes/${slug}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
        if (alive) setCliente(data);
      } catch (e: any) {
        if (alive) setError(e.message || "No se pudo cargar el cliente");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [slug]);

  async function onConnect() {
    if (!slug) return;
    setSyncing(true);
    try {
      const res = await fetch(`/api/clientes/${slug}/sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
      // Opcional: mostrar algún aviso/Toast con data.created / data.drafted
      // Redirige al panel de reseñas
      window.location.href = `/c/${slug}/reviews`;
    } catch (e: any) {
      alert(e.message || "No se pudo sincronizar");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col">
      <AppHeader title={cliente?.nombre ?? "Panel de cliente"} />

      {/* Contenido centrado vertical y horizontalmente */}
      <section className="flex-1 grid place-items-center p-6">
        <div className="w-full max-w-lg card-bordered p-8 text-center">
          {loading && <p className="text-slate-500">Cargando…</p>}
          {!loading && error && <p className="text-rose-600">{error}</p>}

          {!loading && !error && cliente && (
            <>
              <h1 className="text-2xl font-semibold text-slate-900">
                {cliente.nombre}
              </h1>

              <div className="mt-6">
                <button
                  className="btn btn-primary inline-flex items-center gap-2"
                  onClick={onConnect}
                  disabled={syncing}
                >
                  <Globe className="w-4 h-4" />
                  {syncing ? "Sincronizando…" : "Conectar con Google"}
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
