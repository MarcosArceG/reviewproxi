"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { toast } from "sonner";

type Cliente = {
  id: string;
  nombre: string;
  slug: string;
  so: string | null;
  email: string | null;
  urlGoogle: string | null;
  estado: "ACTIVO" | "PAUSADO";
};

export default function EditarClientePage() {
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [cliente, setCliente] = useState<Cliente | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/clientes/${slug}`);
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error || `Error ${r.status}`);
        if (alive) setCliente(data);
      } catch (e: any) {
        toast.error(e.message || "No se pudo cargar el cliente");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [slug]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const nombre = (formData.get("nombre") as string)?.trim();
    const so = (formData.get("so") as string)?.trim() || null;
    const email = (formData.get("email") as string)?.trim() || null;
    const urlGoogle = (formData.get("urlGoogle") as string)?.trim() || null;

    const t = toast.loading("Guardando cambios…");
    try {
      const res = await fetch(`/api/clientes/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, so, email, urlGoogle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
      toast.success("Cliente actualizado.", { id: t });
      router.push("/admin/clientes");
    } catch (e: any) {
      toast.error(e.message || "No se pudo guardar", { id: t });
    }
  }

  return (
    <main className="min-h-screen flex flex-col">
      <AppHeader title="Editar Cliente" />
      <section className="flex-1 grid place-items-center px-6 py-8">
        <div className="w-full max-w-2xl card-bordered p-6">
          <button onClick={() => router.back()} className="btn btn-outline mb-4" type="button">
            ← Volver
          </button>

          {loading ? (
            <p className="text-slate-500">Cargando…</p>
          ) : !cliente ? (
            <p className="text-slate-500">Cliente no encontrado.</p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Cliente *</label>
                <input
                  name="nombre"
                  defaultValue={cliente.nombre}
                  required
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 ring-brand"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">SO</label>
                <input
                  name="so"
                  defaultValue={cliente.so ?? ""}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 ring-brand"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Email</label>
                  <input
                    name="email"
                    type="email"
                    defaultValue={cliente.email ?? ""}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 ring-brand"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    URL de ficha de Google
                  </label>
                  <input
                    name="urlGoogle"
                    type="url"
                    defaultValue={cliente.urlGoogle ?? ""}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 ring-brand"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button className="btn btn-primary" type="submit">Guardar</button>
              </div>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
