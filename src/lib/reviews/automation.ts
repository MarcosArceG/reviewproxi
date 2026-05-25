import type { Automation } from "@prisma/client";

export type AutomationConfig = {
  enabled: boolean;
  minStars: number;
  enabledAt: string | null;
};

export function normalizeMinStars(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 4;
  return Math.min(5, Math.max(1, Math.round(n)));
}

/** ¿Esta reseña puede responderse en automático según la configuración? */
export function isEligibleForAutomation(
  stars: number,
  automation: Pick<Automation, "enabled" | "minStars"> | null | undefined
): boolean {
  if (!automation?.enabled) return false;
  return stars >= automation.minStars;
}

export function automationSummaryLabel(minStars: number): string {
  if (minStars <= 1) return "Todas las reseñas elegibles";
  return `Desde ${minStars} estrellas (las de ${minStars - 1}★ o menos, manual)`;
}
