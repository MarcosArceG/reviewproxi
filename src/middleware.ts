import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware({
  publicRoutes: [
    "/sign-in(.*)",
    "/sign-up(.*)",
    "/api/(.*)",          // ⬅️ deja los endpoints API fuera de Clerk
  ],
});

// ⬅️ excluimos /api del matcher para que no lo toque el middleware
export const config = {
  matcher: ["/((?!_next|.*\\..*|api).*)"],
};
