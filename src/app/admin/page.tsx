import Link from "next/link";
import AppHeader from "@/components/AppHeader";

export default async function AdminHome() {
  return (
    <main className="min-h-screen flex flex-col">
      <AppHeader title="Panel de administración" />

      {/* Contenedor que ocupa el alto restante y centra vertical/horizontal */}
      <section className="flex-1 grid place-items-center px-6 py-8">
        <div className="w-full max-w-6xl">
          <h2 className="text-xl font-semibold text-slate-800 mb-6 text-center">
            Acciones rápidas
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Card: Crear Cliente */}
            <div className="card-bordered p-6">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-[color:var(--brand-50)] grid place-items-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M15 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M3 20a7 7 0 0 1 11.326-5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M19 8v6M16 11h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>

                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900">Crear Cliente</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Da de alta un nuevo cliente, crea su usuario y configura su ficha de Google.
                  </p>
                  <div className="mt-4">
                    <Link href="/admin/clientes/nuevo" className="btn btn-primary">
                      Ir a crear cliente
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Card: Gestionar Clientes */}
            <div className="card-bordered p-6">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-[color:var(--brand-50)] grid place-items-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M15.5 14.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M18.5 16.5l1.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>

                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900">Gestionar Clientes</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Consulta, busca, pausa, edita o elimina clientes existentes desde un único panel.
                  </p>
                  <div className="mt-4">
                    <Link href="/admin/clientes" className="btn btn-primary">
                      Ir a gestionar clientes
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>{/* grid */}
        </div>{/* container */}
      </section>
    </main>
  );
}
