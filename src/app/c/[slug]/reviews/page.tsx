"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { toast } from "sonner";

type Reply = {
  id: string;
  draftText: string;
  finalText: string | null;
  createdBy: "AI" | "USER";
  sentAt: string | null;
};

type Review = {
  id: string;
  authorName: string | null;
  authorPhotoUrl: string | null;
  text: string;
  stars: number;
  date: string;
  status: "PENDIENTE" | "LISTA" | "RESPONDIDA";
  source: "APIFY" | "GOOGLE";
  canPostToGoogle: boolean;
  reply: Reply | null;
};

export default function ClienteReviewsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const slug = useMemo(() => {
    const clean = pathname.replace(/\/+$/, "");
    const parts = clean.split("/");
    return parts[parts.length - 2] || "";
  }, [pathname]);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Review[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [googleConnected, setGoogleConnected] = useState(false);
  const [auto, setAuto] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("google_connected") === "1") {
      toast.success("Google Business conectado correctamente.");
    }
  }, [searchParams]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/clientes/${slug}/reviews`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);

      const list: Review[] = data.items || [];
      setItems(list);
      setGoogleConnected(Boolean(data.googleConnected));
      setDrafts(
        Object.fromEntries(
          list.map((r) => [r.id, r.reply?.draftText || ""])
        )
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudieron cargar las reseñas");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (slug) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function enviarUna(id: string) {
    const text = drafts[id]?.trim();
    if (!text) {
      toast.error("Escribe una respuesta antes de enviar.");
      return;
    }

    setSending(id);
    try {
      const res = await fetch(`/api/clientes/${slug}/reviews/${id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);

      if (data.postedToGoogle) {
        toast.success("Respuesta publicada en Google Maps.");
      } else {
        toast.success(data.message || "Respuesta guardada.");
      }
      setItems((prev) => prev.filter((r) => r.id !== id));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo responder");
    } finally {
      setSending(null);
    }
  }

  async function enviarTodas() {
    if (items.length === 0) return;
    for (const r of [...items]) {
      await enviarUna(r.id);
    }
  }

  function onToggleAuto() {
    if (!auto) {
      const t = toast.warning("¿Activar automatización de respuestas?", {
        description: googleConnected
          ? "Se publicarán en Google cuando la automatización esté activa en backend."
          : "Requiere Google Business conectado para publicar en Maps.",
        action: {
          label: "Activar",
          onClick: () => {
            setAuto(true);
            toast.dismiss(t);
            toast.success("Automatización activada (pendiente de job en servidor).");
          },
        },
        cancel: { label: "Cancelar", onClick: () => {} },
      });
    } else {
      setAuto(false);
      toast.success("Automatización desactivada.");
    }
  }

  return (
    <main className="min-h-screen flex flex-col">
      <AppHeader title="Reseñas" />

      <section className="flex items-center justify-between px-6 pt-6 max-w-6xl mx-auto w-full gap-4 flex-wrap">
        <button className="btn btn-outline" onClick={() => router.push(`/c/${slug}`)}>
          ← Volver
        </button>

        <div className="flex items-center gap-3 flex-wrap">
          {googleConnected ? (
            <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              Publicación real en Google activa
            </span>
          ) : (
            <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              Modo demo — respuestas solo en app
            </span>
          )}

          <button
            type="button"
            role="switch"
            aria-checked={auto}
            onClick={onToggleAuto}
            className="group inline-flex items-center gap-3 select-none px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50"
          >
            <span className="text-sm text-slate-700">Automatizar respuestas</span>
            <span
              className={[
                "h-6 w-11 rounded-full transition-colors",
                auto ? "bg-brand" : "bg-slate-300",
              ].join(" ")}
            >
              <span
                className={[
                  "block h-6 w-6 rounded-full bg-white shadow transition-transform",
                  auto ? "translate-x-5" : "translate-x-0",
                ].join(" ")}
              />
            </span>
          </button>
        </div>
      </section>

      <section className="flex-1 max-w-6xl mx-auto w-full px-6 py-6">
        {loading ? (
          <div className="card p-6 text-slate-500">Cargando…</div>
        ) : items.length === 0 ? (
          <div className="card p-6 text-slate-500">No hay reseñas pendientes.</div>
        ) : (
          <>
            <div className="space-y-4">
              {items.map((r) => (
                <article key={r.id} className="card p-5">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <div className="flex items-center gap-3">
                        {r.authorPhotoUrl ? (
                          <img
                            src={r.authorPhotoUrl}
                            alt=""
                            className="w-10 h-10 rounded-full object-cover bg-slate-100"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-200" />
                        )}
                        <div>
                          <div className="font-medium text-slate-900">
                            {r.authorName || "Cliente"}
                          </div>
                          <div className="text-xs text-slate-500">
                            ⭐ {r.stars} · {new Date(r.date).toLocaleDateString()}
                            {r.source === "GOOGLE" ? " · Google" : " · Demo"}
                          </div>
                        </div>
                      </div>
                      <p className="mt-3 text-slate-800 whitespace-pre-wrap">{r.text}</p>
                    </div>

                    <div>
                      <div className="text-sm text-slate-600 mb-2">
                        Respuesta a{" "}
                        <span className="font-medium">{r.authorName || "Cliente"}</span>
                        {r.canPostToGoogle && (
                          <span className="ml-2 text-xs text-emerald-700">
                            (se publicará en Maps)
                          </span>
                        )}
                      </div>
                      <textarea
                        value={drafts[r.id] ?? ""}
                        onChange={(e) =>
                          setDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))
                        }
                        className="w-full min-h-[140px] rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 ring-brand"
                      />
                      <div className="mt-3 flex justify-end">
                        <button
                          className="btn btn-primary"
                          onClick={() => enviarUna(r.id)}
                          disabled={sending === r.id}
                        >
                          {sending === r.id ? "Enviando…" : "Responder"}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="flex justify-end pt-6">
              <button
                className="btn btn-primary"
                onClick={enviarTodas}
                disabled={loading || items.length === 0 || sending !== null}
              >
                Responder todo
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
