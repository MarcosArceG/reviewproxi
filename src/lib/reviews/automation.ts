import type { Automation } from "@prisma/client";

export type AutomationConfig = {
  enabled: boolean;
  minStars: number;
  enabledAt: string | null;
};

/** minStars=4 → 4★ y 5★; minStars=1 → todas las estrellas. */
export function normalizeMinStars(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 4;
  if (n <= 1) return 1;
  return 4;
}

export function automationSummaryLabel(minStars: number): string {
  if (minStars <= 1) return "Todas las reseñas nuevas";
  return "4★ y 5★ (≤3★ siempre manual)";
}

export function formatAutomateSince(iso: string | Date | null | undefined): string | null {
  if (!iso) return null;
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** ¿Esta reseña puede responderse en automático según la configuración? */
export function isEligibleForAutomation(
  stars: number,
  reviewDate: Date,
  automation:
    | Pick<Automation, "enabled" | "minStars" | "enabledAt">
    | null
    | undefined
): boolean {
  if (!automation?.enabled || !automation.enabledAt) return false;
  if (reviewDate < automation.enabledAt) return false;
  return stars >= automation.minStars;
}

/** Motivo por el que una pendiente queda fuera de la automatización. */
export function automationExclusionReason(
  stars: number,
  reviewDate: Date,
  automation:
    | Pick<Automation, "enabled" | "minStars" | "enabledAt">
    | null
    | undefined
): "historical" | "low_stars" | null {
  if (!automation?.enabled || !automation.enabledAt) return null;
  if (reviewDate < automation.enabledAt) return "historical";
  if (stars < automation.minStars) return "low_stars";
  return null;
}
