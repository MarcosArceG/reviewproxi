import { requireClienteAccess } from "@/lib/auth/session";

export default async function ClienteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireClienteAccess(slug);
  return children;
}
