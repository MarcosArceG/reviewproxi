"use client";

import { useMemo, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (minStars: number) => void;
  saving?: boolean;
  pendingHistorical?: number;
};

export default function AutomationSetupModal({
  open,
  onClose,
  onConfirm,
  saving = false,
  pendingHistorical = 0,
}: Props) {
  const [minStars, setMinStars] = useState(4);

  const activateFromLabel = useMemo(
    () =>
      new Date().toLocaleString("es-ES", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [open]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="automation-title"
    >
      <div className="w-full max-w-lg card-bordered p-6 bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 id="automation-title" className="text-lg font-semibold text-slate-900">
          Activar automatización
        </h2>

        <div className="mt-3 space-y-2 text-sm text-slate-600">
          <p>
            Las reseñas que ya tienes importadas (histórico) se responden{" "}
            <strong>siempre a mano</strong>. La automatización solo aplica a reseñas
            nuevas a partir de ahora.
          </p>
          <p className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            Desde: <strong>{activateFromLabel}</strong>
            {pendingHistorical > 0 && (
              <>
                {" "}
                · <strong>{pendingHistorical}</strong> pendiente
                {pendingHistorical === 1 ? "" : "s"} del histórico (solo manual)
              </>
            )}
          </p>
        </div>

        <p className="mt-4 text-sm font-medium text-slate-800">
          ¿Qué reseñas nuevas quieres responder solas?
        </p>

        <div className="mt-3 space-y-3">
          <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 has-[:checked]:border-brand has-[:checked]:bg-[color:var(--brand-50)]/40">
            <input
              type="radio"
              name="minStars"
              checked={minStars === 4}
              className="mt-1"
              onChange={() => setMinStars(4)}
            />
            <span>
              <span className="font-medium text-slate-900">4★ y 5★</span>
              <span className="block text-xs text-slate-500 mt-0.5">
                Recomendado. Las de 3★ o menos siguen siendo manuales.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 has-[:checked]:border-brand has-[:checked]:bg-[color:var(--brand-50)]/40">
            <input
              type="radio"
              name="minStars"
              checked={minStars === 1}
              className="mt-1"
              onChange={() => setMinStars(1)}
            />
            <span>
              <span className="font-medium text-slate-900">Todas</span>
              <span className="block text-xs text-slate-500 mt-0.5">
                Incluye valoraciones bajas en la cola automática (revisar con cuidado).
              </span>
            </span>
          </label>
        </div>

        <p className="mt-4 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          Un cron diario (≈08:00, Madrid) sincroniza reseñas nuevas y publica las que
          cumplan estrellas y fecha. El resto permanece en <strong>Por responder</strong>.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving}
            onClick={() => onConfirm(minStars)}
          >
            {saving ? "Guardando…" : "Activar automatización"}
          </button>
        </div>
      </div>
    </div>
  );
}
