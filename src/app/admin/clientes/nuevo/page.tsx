"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { toast } from "sonner";

export default function CrearClientePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const nombre = (formData.get("nombre") as string)?.trim();
    const so = (formData.get("so") as string)?.trim() || "";
    const email = (formData.get("email") as string)?.trim();
    const password = (formData.get("password") as string) || "";
    const urlGoogle = (formData.get("urlGoogle") as string)?.trim();

    if (!nombre || !email || !password || !urlGoogle) {
      toast.error("Por favor, completa los campos obligatorios.");
      return;
    }

    setLoading(true);
    const t = toast.loading("Creando cliente...");
    try {
      const res = await fetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, so, email, password, urlGoogle }),
      });

      const isJson = res.headers.get("content-type")?.includes("application/json");
      const data = isJson ? await res.json() : null;

      if (!res.ok) {
        throw new Error(data?.error || `Error ${res.status}`);
      }

      toast.success("Cliente creado correctamente.", { id: t });
      router.push("/admin/clientes");
    } catch (err: any) {
      toast.error(err.message || "No se pudo crear el cliente", { id: t });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col">
      <AppHeader title="Crear Cliente" />

      <section className="flex-1 grid place-items-center px-6 py-8">
        <div className="w-full max-w-2xl card-bordered p-6">
          <button
            onClick={() => router.back()}
            className="btn btn-outline mb-4"
            type="button"
          >
            ← Volver
          </button>

          <h1 className="text-xl font-semibold text-slate-900 mb-4">
            Nuevo cliente
          </h1>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Cliente *
              </label>
              <input
                name="nombre"
                type="text"
                required
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 ring-brand"
                placeholder="Nombre del cliente"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                SO (referencia interna)
              </label>
              <input
                name="so"
                type="text"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 ring-brand"
                placeholder="Código interno"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Email *
                </label>
                <input
                  name="email"
                  type="email"
                  required
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 ring-brand"
                  placeholder="cliente@correo.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Contraseña *
                </label>
                <input
                  name="password"
                  type="password"
                  required
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 ring-brand"
                  placeholder="Contraseña de acceso"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                URL de ficha de Google *
              </label>
              <input
                name="urlGoogle"
                type="url"
                required
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 ring-brand"
                placeholder="https://maps.google.com/..."
              />
            </div>

            <div className="pt-2">
              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? "Creando..." : "Crear cliente"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
