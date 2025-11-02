// src/app/admin/clientes/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Cliente = {
  id: string;
  nombre: string;
  slug: string;
  email: string | null;
  so: string | null;
  urlGoogle: string | null;
  estado: "ACTIVO" | "PAUSADO";
  createdAt: string;
  updatedAt: string;
};

export default function ClientesListadoPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Cliente[]>([]);

  const filtered = useMemo(() => items, [items]);

  async function fetchData(signal?: AbortSignal) {
    setLoading(true);
    try {
      const r = await fetch(`/api/clientes${q ? `?q=${encodeURIComponent(q)}` : ""}`, { signal });
      const isJson = r.headers.get("content-type")?.includes("application/json");
      const data = isJson ? await r.json() : null;
      if (!r.ok) throw new Error(data?.error || `Error ${r.status}`);
      setItems(data?.items ?? []);
    } catch (e: any) {
      // “signal aborted” al cancelar búsquedas rápidas; ignoramos
      if (!/aborted/i.test(String(e?.message))) toast.error(e.message || "Error al cargar clientes");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const ctrl = new AbortController();
    fetchData(ctrl.signal);
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchData(), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // ⏸️/▶️ Pausar / Activar (usamos SLUG)
  const onToggleEstado = async (slug: string, estado: "ACTIVO" | "PAUSADO") => {
    const next = estado === "ACTIVO" ? "PAUSADO" : "ACTIVO";
    const t = toast.loading(`${next === "PAUSADO" ? "Pausando" : "Activando"}…`);
    try {
      const res = await fetch(`/api/clientes/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
      toast.success(`Cliente ${next === "PAUSADO" ? "pausado" : "activado"}.`, { id: t });
      fetchData();
    } catch (e: any) {
      toast.error(e.message || "No se pudo actualizar", { id: t });
    }
  };

  // 🗑️ Borrar (SLUG)
  const onDelete = (slug: string) => {
    toast.warning("¿Eliminar cliente definitivamente?", {
      description: "Esta acción no se puede deshacer.",
      action: {
        label: "Eliminar",
        onClick: async () => {
          const t = toast.loading("Eliminando…");
          try {
            const res = await fetch(`/api/clientes/${slug}`, { method: "DELETE" });
            const isJson = res.headers.get("content-type")?.includes("application/json");
            const data = isJson ? await res.json() : null;

            if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
            toast.success("Cliente eliminado.", { id: t });
            fetchData();
          } catch (e: any) {
            toast.error(e.message || "Error al eliminar", { id: t });
          }
        },
      },
      cancel: { label: "Cancelar" },
    });
  };

  return (
    <main className="min-h-screen flex flex-col">
      <AppHeader title="Gestionar Clientes" />
      <section className="flex-1 px-6 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-4 flex items-center justify-between gap-3">
            <button className="btn btn-outline" onClick={() => router.back()} type="button">
              ← Volver
            </button>

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar cliente…"
              className="w-full sm:w-80 rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 ring-brand"
            />
          </div>

          <div className="overflow-x-auto card">
            <table className="w-full text-left text-sm">
              <thead className="border-b">
                <tr className="[&>th]:px-4 [&>th]:py-3 text-slate-600">
                  <th>Cliente</th>
                  {/* slug oculto */}
                  {/* <th>Slug</th> */}
                  <th>Email</th>
                  <th>Estado</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="[&>tr]:border-b">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                      Cargando…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                      No hay resultados.
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{c.nombre}</div>
                        <div className="text-xs text-slate-500">{c.so ?? ""}</div>
                      </td>
                      {/* slug oculto
                      <td className="px-4 py-3">{c.slug}</td>
                      */}
                      <td className="px-4 py-3">{c.email ?? "-"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            c.estado === "ACTIVO"
                              ? "bg-green-100 text-green-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {c.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {/* Acceso rápido al panel del cliente */}
                          <a
                            href={`/c/${c.slug}`}
                            className="btn btn-outline"
                            title="Abrir panel del cliente"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Acceso cliente
                          </a>

                          <button
                            className="btn btn-outline"
                            onClick={() => onToggleEstado(c.slug, c.estado)}
                          >
                            {c.estado === "ACTIVO" ? "Pausar" : "Activar"}
                          </button>

                          <button
                            className="btn btn-outline"
                            onClick={() => router.push(`/admin/clientes/${c.slug}`)}
                          >
                            Editar
                          </button>

                          <button className="btn btn-primary" onClick={() => onDelete(c.slug)}>
                            Borrar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
