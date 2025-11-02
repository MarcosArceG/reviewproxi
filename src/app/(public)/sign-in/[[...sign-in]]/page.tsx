"use client";
import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-md bg-white border rounded-xl shadow-sm p-6">
        <SignIn
          afterSignInUrl="/"
          appearance={{
            elements: {
              footerAction: "hidden",
              footerActionText: "hidden",
              formButtonPrimary: "bg-[#004357] hover:bg-[#004357]/90",
            },
            variables: {
              colorPrimary: "#004357",
            },
          }}
        />
      </div>
    </main>
  );
}
