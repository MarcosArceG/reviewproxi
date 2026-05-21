/** Extrae slug/ID desde params de ruta dinámica o desde la URL. */
export function getSlugFromRequest(
  req: Request,
  params?: Record<string, string | string[] | undefined>,
  /** Segmento antes del último en la URL (p. ej. sync → penúltimo). */
  segmentFromEnd = 1
): string | undefined {
  let slug = params?.slug;
  if (Array.isArray(slug)) slug = slug[0];
  if (typeof slug === "string" && slug.trim()) return slug.trim();

  const { pathname } = new URL(req.url);
  const parts = pathname.replace(/\/+$/, "").split("/");
  const idx = parts.length - 1 - segmentFromEnd;
  return parts[idx] || undefined;
}
