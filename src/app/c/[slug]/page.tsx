"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { Globe, Link2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type GoogleStatus = {
  configured: boolean;
  connected: boolean;
  status: string | null;
  connectedAt: string | null;
  lastError: string | null;
};

type Cliente = {
  id: string;
  nombre: string;
  slug: string;
  estado: "ACTIVO" | "PAUSADO";
  urlGoogle: string | null;
  syncProvider: "apify" | "google";
  google: GoogleStatus;
};

export default function ClientePanelPage() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const slug = useMemo(() => {
    if (!pathname) return "";
    const clean = pathname.replace(/\/+$/, "");
    const parts = clean.split("/");
    return parts[parts.length - 1] || "";
  }, [pathname]);

  const [loading, setLoading] = useState(true);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"oauth" | "sync" | null>(null);

  useEffect(() => {
    const googleError = searchParams.get("google_error");
    if (googleError) {
      toast.error(decodeURIComponent(googleError));
    }
  }, [searchParams]);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        if (!slug) throw new Error("No se recibió slug en la ruta.");
        const res = await fetch(`/api/clientes/${slug}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
        if (alive) setCliente(data);
      } catch (e: unknown) {
        if (alive) {
          setError(e instanceof Error ? e.message : "No se pudo cargar el cliente");
        }
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [slug]);

  async function onConnectGoogle() {
    if (!slug) return;
    setBusy("oauth");
    try {
      const res = await fetch(`/api/clientes/${slug}/google/connect`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);

      if (!data.configured) {
        toast.info(data.message || "OAuth no configurado; usa sincronización demo.");
        return;
      }

      window.location.href = data.authUrl;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo iniciar OAuth");
    } finally {
      setBusy(null);
    }
  }

  async function onSyncDemo() {
    if (!slug) return;
    setBusy("sync");
    try {
      const res = await fetch(`/api/clientes/${slug}/sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);

      const via = data.provider === "google" ? "Google API" : "Apify (demo)";
      toast.success(`Sincronizado vía ${via}: ${data.created} nuevas`);
      window.location.href = `/c/${slug}/reviews`;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo sincronizar");
    } finally {
      setBusy(null);
    }
  }

  const googleConnected = cliente?.google?.connected;
  const oauthConfigured = cliente?.google?.configured;

  return (
    <main className="min-h-screen flex flex-col">
      <AppHeader title={cliente?.nombre ?? "Panel de cliente"} />

      <section className="flex-1 grid place-items-center p-6">
        <div className="w-full max-w-lg card-bordered p-8 text-center">
          {loading && <p className="text-slate-500">Cargando…</p>}
          {!loading && error && <p className="text-rose-600">{error}</p>}

          {!loading && !error && cliente && (
            <>
              <h1 className="text-2xl font-semibold text-slate-900">{cliente.nombre}</h1>

              <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs">
                {googleConnected ? (
                  <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Google Business conectado
                  </span>
                ) : oauthConfigured ? (
                  <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                    Google OAuth disponible — pendiente de conectar
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    Modo demo (Apify)
                  </span>
                )}
                {cliente.syncProvider === "google" && (
                  <span className="px-2 py-1 rounded-full bg-brand/10 text-brand border border-brand/20">
                    Respuestas reales en Maps
                  </span>
                )}
              </div>

              {cliente.google?.lastError && (
                <p className="mt-3 text-sm text-rose-600">{cliente.google.lastError}</p>
              )}

              <div className="mt-6 flex flex-col gap-3">
                {oauthConfigured && !googleConnected && (
                  <button
                    className="btn btn-primary inline-flex items-center justify-center gap-2"
                    onClick={onConnectGoogle}
                    disabled={busy !== null}
                  >
                    <Link2 className="w-4 h-4" />
                    {busy === "oauth" ? "Redirigiendo…" : "Conectar Google Business"}
                  </button>
                )}

                <button
                  className="btn btn-outline inline-flex items-center justify-center gap-2"
                  onClick={onSyncDemo}
                  disabled={busy !== null}
                >
                  <RefreshCw className="w-4 h-4" />
                  {busy === "sync"
                    ? "Sincronizando…"
                    : googleConnected
                      ? "Sincronizar reseñas (Google)"
                      : "Importar reseñas (demo Apify)"}
                </button>

                {googleConnected && (
                  <a
                    href={`/c/${slug}/reviews`}
                    className="btn btn-primary inline-flex items-center justify-center gap-2"
                  >
                    <Globe className="w-4 h-4" />
                    Ver reseñas pendientes
                  </a>
                )}
              </div>

              {!oauthConfigured && (
                <p className="mt-4 text-xs text-slate-500">
                  Cuando Google apruebe la API, configura OAuth en el servidor y el botón de
                  conexión real aparecerá aquí. Mientras tanto, usa importación demo.
                </p>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
