import Link from "next/link";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { getAppUser, getHomePath } from "@/lib/auth/session";

export default async function SinAccesoPage() {
  const user = await getAppUser();
  if (user) {
    const home = getHomePath(user);
    if (home !== "/sin-acceso") redirect(home);
  }

  return (
    <main className="min-h-screen flex flex-col">
      <AppHeader title="Sin acceso" />
      <section className="flex-1 grid place-items-center p-6">
        <div className="max-w-md text-center card-bordered p-8">
          <h1 className="text-xl font-semibold text-slate-900">Sin acceso al panel</h1>
          <p className="mt-3 text-sm text-slate-600">
            Tu usuario no está vinculado a ningún cliente. Contacta con Proximedia
            para que te den de alta.
          </p>
          <Link href="/sign-in" className="btn btn-outline mt-6 inline-block">
            Volver al inicio de sesión
          </Link>
        </div>
      </section>
    </main>
  );
}
