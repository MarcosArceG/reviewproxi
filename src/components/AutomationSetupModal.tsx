"use client";

import { useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (minStars: number) => void;
  saving?: boolean;
};

export default function AutomationSetupModal({
  open,
  onClose,
  onConfirm,
  saving = false,
}: Props) {
  const [minStars, setMinStars] = useState(4);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="automation-title"
    >
      <div className="w-full max-w-md card-bordered p-6 bg-white shadow-xl">
        <h2 id="automation-title" className="text-lg font-semibold text-slate-900">
          Automatizar respuestas
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Elige qué reseñas pueden responderse solas (con el borrador de IA). Las que
          queden fuera seguirán en <strong>Pendientes</strong> para gestionarlas tú.
        </p>

        <div className="mt-4 space-y-3">
          <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 has-[:checked]:border-brand has-[:checked]:bg-[color:var(--brand-50)]/40">
            <input
              type="radio"
              name="minStars"
              checked={minStars === 4}
              className="mt-1"
              onChange={() => setMinStars(4)}
            />
            <span>
              <span className="font-medium text-slate-900">Desde 4 estrellas</span>
              <span className="block text-xs text-slate-500 mt-0.5">
                Recomendado: 3★ o menos, siempre manual.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 has-[:checked]:border-brand has-[:checked]:bg-[color:var(--brand-50)]/40">
            <input
              type="radio"
              name="minStars"
              checked={minStars === 5}
              className="mt-1"
              onChange={() => setMinStars(5)}
            />
            <span>
              <span className="font-medium text-slate-900">Solo 5 estrellas</span>
              <span className="block text-xs text-slate-500 mt-0.5">
                Más conservador.
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
              <span className="font-medium text-slate-900">Todas las pendientes</span>
              <span className="block text-xs text-slate-500 mt-0.5">
                Incluye valoraciones bajas (revisar con cuidado).
              </span>
            </span>
          </label>
        </div>

        <p className="mt-4 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          Un cron diario (≈08:00 hora de Madrid) sincroniza reseñas y responde las
          que cumplan este criterio de estrellas. Las demás siguen en Pendientes.
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
