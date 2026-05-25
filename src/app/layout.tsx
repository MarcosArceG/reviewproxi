import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import ToasterProvider from "@/components/ToasterProvider";
import {
  clerkAppearance,
  clerkAuthPaths,
  clerkLocalization,
} from "@/lib/clerk-appearance";

export const metadata: Metadata = { title: "ReviewProxi" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      localization={clerkLocalization}
      appearance={clerkAppearance}
      signInUrl={clerkAuthPaths.signInUrl}
      signUpUrl={clerkAuthPaths.signUpUrl}
      signInFallbackRedirectUrl={clerkAuthPaths.afterSignInUrl}
      signUpFallbackRedirectUrl={clerkAuthPaths.afterSignUpUrl}
      afterSignOutUrl={clerkAuthPaths.afterSignOutUrl}
    >
      <html lang="es">
        <body className="antialiased">
          <ToasterProvider />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
