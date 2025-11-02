import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { esES } from "@clerk/localizations";
import ToasterProvider from "@/components/ToasterProvider"; // ⬅️ nuevo

export const metadata: Metadata = { title: "ReviewProxi" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider localization={esES} appearance={{
      variables: {
        colorPrimary: "#004357",
        colorText: "#0f172a",
        colorBackground: "white",
        colorInputBackground: "white",
        colorInputText: "#0f172a",
      },
      elements: {
        footerAction: "hidden",
        footerActionText: "hidden",
        formButtonPrimary: "bg-[#004357] hover:bg-[#004357]/90",
      },
    }}>
      <html lang="es">
        <body className="antialiased">
          <ToasterProvider /> {/* ⬅️ aquí */}
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
