"use client";

import { SignIn } from "@clerk/nextjs";
import Image from "next/image";
import { clerkAppearance, clerkAuthPaths } from "@/lib/clerk-appearance";

export default function SignInPage() {
  return (
    <main className="min-h-screen grid place-items-center p-6 bg-slate-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Image
            src="/logo.png"
            alt="ReviewProxi"
            width={160}
            height={40}
            className="h-10 w-auto mx-auto object-contain"
            priority
          />
          <h1 className="mt-4 text-xl font-semibold text-slate-900">
            Iniciar sesión
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Accede al panel de gestión de reseñas
          </p>
        </div>

        <div className="card-bordered p-6 bg-white">
          <SignIn
            routing="path"
            path={clerkAuthPaths.signInUrl}
            forceRedirectUrl={clerkAuthPaths.afterSignInUrl}
            fallbackRedirectUrl={clerkAuthPaths.afterSignInUrl}
            signUpUrl={clerkAuthPaths.signUpUrl}
            appearance={clerkAppearance}
          />
        </div>
      </div>
    </main>
  );
}
