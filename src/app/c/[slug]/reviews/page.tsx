"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

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
  hasAiDraft: boolean;
  requiresManualDraft: boolean;
  canPostToGoogle: boolean;
  reply: Reply | null;
};

export default function ClienteReviewsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoDraftStarted = useRef(false);

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
  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("google_connected") === "1") {
      toast.success("Google Business conectado correctamente.");
    }
  }, [searchParams]);

  const load = useCallback(async () => {
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
          list.map((r) => [r.id, r.reply?.draftText?.trim() || ""])
        )
      );
      return list;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudieron cargar las reseñas");
      setItems([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const generarBorrador = useCallback(
    async (reviewId: string, silent = false) => {
      setGenerating(reviewId);
      try {
        const res = await fetch(
          `/api/clientes/${slug}/reviews/${reviewId}/draft`,
          { method: "POST" }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);

        if (data.skipped) {
          setDrafts((prev) => ({ ...prev, [reviewId]: "" }));
          setItems((prev) =>
            prev.map((r) =>
              r.id === reviewId
                ? { ...r, hasAiDraft: false, requiresManualDraft: true, reply: null }
                : r
            )
          );
          if (!silent) toast.info(data.reason || "Escribe la respuesta manualmente.");
          return;
        }

        const text = data.draftText || "";
        setDrafts((prev) => ({ ...prev, [reviewId]: text }));
        setItems((prev) =>
          prev.map((r) =>
            r.id === reviewId
              ? {
                  ...r,
                  hasAiDraft: true,
                  requiresManualDraft: false,
                  reply: r.reply
                    ? { ...r.reply, draftText: text, createdBy: "AI" }
                    : {
                        id: "",
                        draftText: text,
                        finalText: null,
                        createdBy: "AI",
                        sentAt: null,
                      },
                }
              : r
          )
        );
        if (!silent) {
          toast.success(
            text.includes("Muchas gracias") && text.length < 200
              ? "Borrador sugerido listo."
              : "Borrador generado con IA."
          );
        }
      } catch (e: unknown) {
        if (!silent) {
          toast.error(e instanceof Error ? e.message : "No se pudo generar el borrador");
        }
        throw e;
      } finally {
        setGenerating(null);
      }
    },
    [slug]
  );

  useEffect(() => {
    if (!slug) return;
    load().then((list) => {
      if (autoDraftStarted.current || !list.length) return;
      const sinBorrador = list.filter(
        (r) => !r.hasAiDraft && !r.requiresManualDraft
      );
      if (!sinBorrador.length) return;
      autoDraftStarted.current = true;

      (async () => {
        for (const r of sinBorrador) {
          try {
            await generarBorrador(r.id, true);
          } catch {
            break;
          }
        }
        if (sinBorrador.length > 0) {
          toast.info("Borradores de IA listos para revisar.");
        }
      })();
    });
  }, [slug, load, generarBorrador]);

  async function enviarUna(id: string) {
    const text = drafts[id]?.trim();
    if (!text) {
      toast.error("Escribe o genera una respuesta antes de enviar.");
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
          ? "Se publicarán en Google cuando la automatización esté activa en servidor."
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
      <AppHeader title="Reseñas pendientes" />

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
              Modo demo — solo reseñas sin respuesta del negocio
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
          <div className="card p-6 text-slate-500">Cargando reseñas…</div>
        ) : items.length === 0 ? (
          <div className="card p-6 text-slate-500">
            No hay reseñas pendientes de respuesta. Las que ya tienen respuesta en
            Google no se muestran aquí.
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-600 mb-4">
              Solo ves reseñas sin respuesta del negocio. El borrador de la IA es
              editable antes de publicar.
            </p>

            <div className="space-y-4">
              {items.map((r) => {
                const draft = drafts[r.id] ?? "";
                const isGenerating = generating === r.id;
                const isSending = sending === r.id;

                return (
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
                            </div>
                          </div>
                        </div>
                        {r.text.trim() ? (
                          <p className="mt-3 text-slate-800 whitespace-pre-wrap">{r.text}</p>
                        ) : (
                          <p className="mt-3 text-sm text-slate-500 italic">
                            Sin comentario escrito — solo valoración de {r.stars} estrellas.
                          </p>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="text-sm text-slate-600">
                            <span className="font-medium">Borrador sugerido (IA)</span>
                            {r.canPostToGoogle && (
                              <span className="ml-2 text-xs text-emerald-700">
                                · se publicará en Maps
                              </span>
                            )}
                          </div>
                          {!r.requiresManualDraft && (
                            <button
                              type="button"
                              className="text-xs inline-flex items-center gap-1 text-brand hover:underline disabled:opacity-50"
                              onClick={() => generarBorrador(r.id)}
                              disabled={isGenerating || isSending}
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              {isGenerating ? "Generando…" : "Regenerar"}
                            </button>
                          )}
                        </div>

                        <textarea
                          value={draft}
                          onChange={(e) =>
                            setDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))
                          }
                          placeholder={
                            r.requiresManualDraft
                              ? "Valoración baja sin texto: escribe una respuesta personalizada (no usamos IA aquí)."
                              : isGenerating
                                ? "Generando borrador…"
                                : "Pulsa «Regenerar» o escribe tu respuesta."
                          }
                          disabled={isGenerating}
                          className={[
                            "w-full min-h-[140px] rounded-xl border px-3 py-2 outline-none focus:ring-2 ring-brand",
                            r.hasAiDraft || draft
                              ? "border-slate-300 bg-[color:var(--brand-50)]/30"
                              : "border-slate-300 bg-white",
                          ].join(" ")}
                        />

                        <div className="mt-3 flex justify-end gap-2">
                          {!draft.trim() && !isGenerating && !r.requiresManualDraft && (
                            <button
                              type="button"
                              className="btn btn-outline inline-flex items-center gap-2"
                              onClick={() => generarBorrador(r.id)}
                            >
                              <Sparkles className="w-4 h-4" />
                              Generar borrador
                            </button>
                          )}
                          <button
                            className="btn btn-primary"
                            onClick={() => enviarUna(r.id)}
                            disabled={isSending || isGenerating || !draft.trim()}
                          >
                            {isSending ? "Enviando…" : "Responder"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="flex justify-end pt-6">
              <button
                className="btn btn-primary"
                onClick={enviarTodas}
                disabled={loading || items.length === 0 || sending !== null || generating !== null}
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
