"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import AutomationSetupModal from "@/components/AutomationSetupModal";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

type Tab = "pending" | "responded";
type RespondedMode = "all" | "manual" | "auto";

type AutomationState = {
  enabled: boolean;
  minStars: number;
  summary?: string;
  counts?: {
    pending: number;
    pendingEligible: number;
    pendingManualOnly: number;
    respondedManual: number;
    respondedAuto: number;
  };
};

type Reply = {
  id: string;
  draftText: string;
  finalText: string | null;
  createdBy: "AI" | "USER";
  sentAt: string | null;
  sentByAutomation?: boolean;
};

type PendingReview = {
  id: string;
  authorName: string | null;
  authorPhotoUrl: string | null;
  text: string;
  stars: number;
  date: string;
  hasAiDraft: boolean;
  requiresManualDraft: boolean;
  isTemplateDraft: boolean;
  suggestedDraftText?: string;
  eligibleForAutomation?: boolean;
  automationManualOnly?: boolean;
  canPostToGoogle: boolean;
  reply: Reply | null;
};

type RespondedReview = {
  id: string;
  authorName: string | null;
  authorPhotoUrl: string | null;
  text: string;
  stars: number;
  date: string;
  sentByAutomation: boolean;
  responseText: string;
  sentAt: string | null;
};

function ReviewAuthorBlock({
  authorName,
  authorPhotoUrl,
  stars,
  date,
}: {
  authorName: string | null;
  authorPhotoUrl: string | null;
  stars: number;
  date: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {authorPhotoUrl ? (
        <img
          src={authorPhotoUrl}
          alt=""
          className="w-10 h-10 rounded-full object-cover bg-slate-100"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-slate-200" />
      )}
      <div>
        <div className="font-medium text-slate-900">{authorName || "Cliente"}</div>
        <div className="text-xs text-slate-500">
          ⭐ {stars} · {new Date(date).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}

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

  const [tab, setTab] = useState<Tab>("pending");
  const [respondedMode, setRespondedMode] = useState<RespondedMode>("all");
  const [loading, setLoading] = useState(true);
  const [pendingItems, setPendingItems] = useState<PendingReview[]>([]);
  const [respondedItems, setRespondedItems] = useState<RespondedReview[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [googleConnected, setGoogleConnected] = useState(false);
  const [automation, setAutomation] = useState<AutomationState>({
    enabled: false,
    minStars: 4,
  });
  const [showAutomationModal, setShowAutomationModal] = useState(false);
  const [savingAutomation, setSavingAutomation] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);

  const loadAutomation = useCallback(async () => {
    const res = await fetch(`/api/clientes/${slug}/automation`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) return;
    setAutomation({
      enabled: Boolean(data.enabled),
      minStars: data.minStars ?? 4,
      summary: data.summary,
      counts: data.counts,
    });
  }, [slug]);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    try {
      const qs =
        tab === "responded"
          ? `view=responded&mode=${respondedMode}`
          : "view=pending";
      const res = await fetch(`/api/clientes/${slug}/reviews?${qs}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);

      setGoogleConnected(Boolean(data.googleConnected));
      if (data.automation) {
        setAutomation((prev) => ({
          ...prev,
          enabled: data.automation.enabled,
          minStars: data.automation.minStars,
        }));
      }

      if (tab === "responded") {
        setRespondedItems(data.items || []);
      } else {
        const list: PendingReview[] = data.items || [];
        setPendingItems(list);
        setDrafts(
          Object.fromEntries(
            list.map((r) => [
              r.id,
              r.suggestedDraftText?.trim() || r.reply?.draftText?.trim() || "",
            ])
          )
        );
        return list;
      }
      return [];
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudieron cargar las reseñas");
      if (tab === "pending") setPendingItems([]);
      else setRespondedItems([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [slug, tab, respondedMode]);

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
          setPendingItems((prev) =>
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
        setPendingItems((prev) =>
          prev.map((r) =>
            r.id === reviewId ? { ...r, hasAiDraft: true, requiresManualDraft: false } : r
          )
        );
        if (!silent) toast.success("Borrador actualizado.");
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
    loadAutomation();
  }, [slug, loadAutomation]);

  useEffect(() => {
    if (!slug) return;
    if (tab === "pending") autoDraftStarted.current = false;
    loadReviews().then((list) => {
      if (tab !== "pending" || autoDraftStarted.current || !list.length) return;
      const sinBorrador = list.filter(
        (r: PendingReview) => !r.hasAiDraft && !r.requiresManualDraft
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
      })();
    });
  }, [slug, tab, respondedMode, loadReviews, generarBorrador]);

  useEffect(() => {
    if (searchParams.get("google_connected") === "1") {
      toast.success("Google Business conectado correctamente.");
    }
  }, [searchParams]);

  async function saveAutomation(enabled: boolean, minStars: number) {
    setSavingAutomation(true);
    try {
      const res = await fetch(`/api/clientes/${slug}/automation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, minStars }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
      setAutomation((prev) => ({
        ...prev,
        enabled: data.enabled,
        minStars: data.minStars,
        summary: data.summary,
      }));
      await loadAutomation();
      if (enabled) {
        toast.success(`Automatización activa: ${data.summary}`);
      } else {
        toast.success("Automatización desactivada.");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
      throw e;
    } finally {
      setSavingAutomation(false);
    }
  }

  function onToggleAuto() {
    if (automation.enabled) {
      saveAutomation(false, automation.minStars);
      return;
    }
    setShowAutomationModal(true);
  }

  async function onConfirmAutomation(minStars: number) {
    try {
      await saveAutomation(true, minStars);
      setShowAutomationModal(false);
    } catch {
      /* toast ya mostrado */
    }
  }

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
      toast.success(data.postedToGoogle ? "Respuesta publicada." : data.message || "Guardada.");
      setPendingItems((prev) => prev.filter((r) => r.id !== id));
      await loadAutomation();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo responder");
    } finally {
      setSending(null);
    }
  }

  const counts = automation.counts;

  return (
    <main className="min-h-screen flex flex-col">
      <AppHeader title="Reseñas" />
      <AutomationSetupModal
        open={showAutomationModal}
        onClose={() => setShowAutomationModal(false)}
        onConfirm={onConfirmAutomation}
        saving={savingAutomation}
      />

      <section className="px-6 pt-6 max-w-6xl mx-auto w-full space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button className="btn btn-outline" onClick={() => router.push(`/c/${slug}`)}>
            ← Volver
          </button>

          <div className="flex items-center gap-3 flex-wrap">
            {automation.enabled && (
              <span className="text-xs px-2 py-1 rounded-full bg-brand/10 text-brand border border-brand/20">
                Auto: {automation.summary || `desde ${automation.minStars}★`}
              </span>
            )}
            <button
              type="button"
              role="switch"
              aria-checked={automation.enabled}
              onClick={onToggleAuto}
              className="inline-flex items-center gap-3 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50"
            >
              <span className="text-sm text-slate-700">Automatizar respuestas</span>
              <span
                className={[
                  "h-6 w-11 rounded-full transition-colors",
                  automation.enabled ? "bg-brand" : "bg-slate-300",
                ].join(" ")}
              >
                <span
                  className={[
                    "block h-6 w-6 rounded-full bg-white shadow transition-transform",
                    automation.enabled ? "translate-x-5" : "translate-x-0",
                  ].join(" ")}
                />
              </span>
            </button>
          </div>
        </div>

        {counts && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
            <div className="card p-3">
              <div className="font-semibold text-slate-900">{counts.pending}</div>
              <div className="text-slate-500">Pendientes</div>
            </div>
            <div className="card p-3">
              <div className="font-semibold text-emerald-700">{counts.pendingEligible}</div>
              <div className="text-slate-500">En cola auto</div>
            </div>
            <div className="card p-3">
              <div className="font-semibold text-slate-700">{counts.respondedManual}</div>
              <div className="text-slate-500">Resp. manual</div>
            </div>
            <div className="card p-3">
              <div className="font-semibold text-brand">{counts.respondedAuto}</div>
              <div className="text-slate-500">Resp. automática</div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
          <button
            type="button"
            className={[
              "px-4 py-2 rounded-lg text-sm font-medium",
              tab === "pending" ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-100",
            ].join(" ")}
            onClick={() => setTab("pending")}
          >
            Por responder
            {counts ? ` (${counts.pending})` : ""}
          </button>
          <button
            type="button"
            className={[
              "px-4 py-2 rounded-lg text-sm font-medium",
              tab === "responded"
                ? "bg-brand text-white"
                : "text-slate-600 hover:bg-slate-100",
            ].join(" ")}
            onClick={() => setTab("responded")}
          >
            Respondidas
            {counts
              ? ` (${counts.respondedManual + counts.respondedAuto})`
              : ""}
          </button>
        </div>

        {tab === "responded" && (
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", "Todas"],
                ["manual", "Manuales"],
                ["auto", "Automáticas"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                className={[
                  "text-xs px-3 py-1.5 rounded-full border",
                  respondedMode === m
                    ? "bg-slate-800 text-white border-slate-800"
                    : "bg-white text-slate-600 border-slate-300",
                ].join(" ")}
                onClick={() => setRespondedMode(m)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="flex-1 max-w-6xl mx-auto w-full px-6 py-6">
        {loading ? (
          <div className="card p-6 text-slate-500">Cargando…</div>
        ) : tab === "pending" ? (
          pendingItems.length === 0 ? (
            <div className="card p-6 text-slate-500">No hay reseñas pendientes.</div>
          ) : (
            <div className="space-y-4">
              {pendingItems.map((r) => {
                const draft = drafts[r.id] ?? "";
                return (
                  <article key={r.id} className="card p-5">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <ReviewAuthorBlock
                          authorName={r.authorName}
                          authorPhotoUrl={r.authorPhotoUrl}
                          stars={r.stars}
                          date={r.date}
                        />
                        {r.automationManualOnly && (
                          <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                            Solo manual (≤{automation.minStars - 1}★ con auto activo)
                          </span>
                        )}
                        {r.eligibleForAutomation && automation.enabled && (
                          <span className="inline-block mt-2 ml-1 text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                            Entra en automatización
                          </span>
                        )}
                        {r.text.trim() ? (
                          <p className="mt-3 text-slate-800 whitespace-pre-wrap">{r.text}</p>
                        ) : (
                          <p className="mt-3 text-sm text-slate-500 italic">
                            Sin comentario — solo {r.stars} estrellas.
                          </p>
                        )}
                      </div>
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm font-medium text-slate-600">
                            {r.isTemplateDraft ? "Plantilla sugerida" : "Borrador (IA)"}
                          </span>
                          {!r.requiresManualDraft && (
                            <button
                              type="button"
                              className="text-xs text-brand hover:underline inline-flex items-center gap-1"
                              onClick={() => generarBorrador(r.id)}
                              disabled={generating === r.id}
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              Regenerar
                            </button>
                          )}
                        </div>
                        <textarea
                          value={draft}
                          onChange={(e) =>
                            setDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))
                          }
                          className="w-full min-h-[140px] rounded-xl border border-slate-300 px-3 py-2 focus:ring-2 ring-brand"
                        />
                        <div className="mt-3 flex justify-end">
                          <button
                            className="btn btn-primary"
                            onClick={() => enviarUna(r.id)}
                            disabled={sending === r.id || !draft.trim()}
                          >
                            {sending === r.id ? "Enviando…" : "Responder"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )
        ) : respondedItems.length === 0 ? (
          <div className="card p-6 text-slate-500">
            No hay reseñas respondidas en este filtro.
          </div>
        ) : (
          <div className="space-y-4">
            {respondedItems.map((r) => (
              <article key={r.id} className="card p-5">
                <div className="flex justify-between items-start gap-4 mb-3">
                  <ReviewAuthorBlock
                    authorName={r.authorName}
                    authorPhotoUrl={r.authorPhotoUrl}
                    stars={r.stars}
                    date={r.date}
                  />
                  <span
                    className={[
                      "text-xs px-2 py-1 rounded-full shrink-0",
                      r.sentByAutomation
                        ? "bg-brand/10 text-brand border border-brand/20"
                        : "bg-slate-100 text-slate-700 border border-slate-200",
                    ].join(" ")}
                  >
                    {r.sentByAutomation ? "Automática" : "Manual"}
                  </span>
                </div>
                {r.text.trim() && (
                  <p className="text-sm text-slate-600 mb-3 whitespace-pre-wrap">{r.text}</p>
                )}
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                  <div className="text-xs text-slate-500 mb-1">
                    Respuesta
                    {r.sentAt
                      ? ` · ${new Date(r.sentAt).toLocaleString()}`
                      : ""}
                  </div>
                  <p className="text-slate-800 whitespace-pre-wrap">{r.responseText}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
