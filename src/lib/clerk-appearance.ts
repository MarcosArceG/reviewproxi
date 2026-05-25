import type { LocalizationResource } from "@clerk/types";
import { esES } from "@clerk/localizations";

/** Apariencia y textos en español para componentes embebidos de Clerk. */
export const clerkLocalization: LocalizationResource = esES;

export const clerkAppearance = {
  variables: {
    colorPrimary: "#004357",
    colorText: "#0f172a",
    colorBackground: "white",
    colorInputBackground: "white",
    colorInputText: "#0f172a",
    borderRadius: "0.75rem",
  },
  elements: {
    footerAction: "hidden",
    footerActionText: "hidden",
    footer: "hidden",
    card: "shadow-none border-0 p-0",
    headerTitle: "text-slate-900",
    headerSubtitle: "text-slate-600",
    formButtonPrimary:
      "bg-[#004357] hover:bg-[#004357]/90 text-sm font-medium normal-case",
    formFieldInput:
      "rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#004357]",
  },
} as const;

export const clerkAuthPaths = {
  signInUrl: "/sign-in",
  signUpUrl: "/sign-in",
  afterSignInUrl: "/",
  afterSignUpUrl: "/",
  afterSignOutUrl: "/sign-in",
} as const;
