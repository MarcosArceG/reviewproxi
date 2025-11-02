// src/app/c/[slug]/reviews/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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
  reply: Reply | null;
};

export default function ClienteReviewsPage() {
  const pathname = usePathname();
  const router = useRouter();

  const slug = useMemo(() => {
    const clean = pathname.replace(/\/+$/, "");
    const parts = clean.split("/");
    // /c/[slug]/reviews -> penúltimo
    return parts[parts.length - 2] || "";
  }, [pathname]);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Review[]>([]);
  const [auto, setAuto] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/clientes/${slug}/reviews`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
      setItems(data.items || []);
    } catch (e: any) {
      toast.error(e.message || "No se pudieron cargar las reseñas");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (slug) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Enviar 1 → toast + quitar del listado
  function enviarUna(id: string) {
    toast.success("Reseña respondida.");
    setItems((prev) => prev.filter((r) => r.id !== id));
  }

  // Enviar todas (lo movemos al final del listado)
  function enviarTodas() {
    if (items.length === 0) return;
    toast.success("Todas las reseñas respondidas.");
    setItems([]);
  }

  // Toggle automático con confirmación
  function onToggleAuto() {
    if (!auto) {
      const t = toast.warning("¿Activar automatización de respuestas?", {
        description: "Se enviarán respuestas automáticamente.",
        action: {
          label: "Activar",
          onClick: () => {
            setAuto(true);
            setItems([]);
            toast.dismiss(t);
            toast.success("Automatización activada.");
          },
        },
        cancel: { label: "Cancelar" },
      });
    } else {
      setAuto(false);
      toast.success("Automatización desactivada.");
    }
  }

  return (
    <main className="min-h-screen flex flex-col">
      <AppHeader title="Reseñas" />

      {/* Barra superior simple: volver + switch vistoso */}
      <section className="flex items-center justify-between px-6 pt-6 max-w-6xl mx-auto w-full">
        <button className="btn btn-outline" onClick={() => router.push(`/c/${slug}`)}>
          ← Volver
        </button>

        {/* Toggle estilo switch (sin librerías) */}
        <button
          type="button"
          role="switch"
          aria-checked={auto}
          onClick={onToggleAuto}
          className={[
            "group inline-flex items-center gap-3 select-none",
            "px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50",
          ].join(" ")}
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
      </section>

      {/* Lista emparejada: bloque por reseña */}
      <section className="flex-1 max-w-6xl mx-auto w-full px-6 py-6">
        {loading ? (
          <div className="card p-6 text-slate-500">Cargando…</div>
        ) : items.length === 0 ? (
          <div className="card p-6 text-slate-500">No hay reseñas.</div>
        ) : (
          <>
            <div className="space-y-4">
              {items.map((r) => (
                <article key={r.id} className="card p-5">
                  {/* Grid interno 2 columnas (responsive) para reseña ↔ respuesta */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Columna izquierda: Reseña */}
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
                          </div>
                        </div>
                      </div>
                      <p className="mt-3 text-slate-800 whitespace-pre-wrap">{r.text}</p>
                    </div>

                    {/* Columna derecha: Respuesta (draft editable) */}
                    <div>
                      <div className="text-sm text-slate-600 mb-2">
                        Respuesta a{" "}
                        <span className="font-medium">{r.authorName || "Cliente"}</span>
                      </div>
                      <textarea
                        defaultValue={r.reply?.draftText || ""}
                        className="w-full min-h-[140px] rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 ring-brand"
                      />
                      <div className="mt-3 flex justify-end">
                        <button className="btn btn-primary" onClick={() => enviarUna(r.id)}>
                          Responder
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {/* Botón inferior “Responder todo” */}
            <div className="flex justify-end pt-6">
              <button
                className="btn btn-primary"
                onClick={enviarTodas}
                disabled={loading || items.length === 0}
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
