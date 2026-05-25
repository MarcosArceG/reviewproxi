import { redirect } from "next/navigation";
import { getAppUser, getHomePath } from "@/lib/auth/session";

export default async function Home() {
  const user = await getAppUser();
  if (!user) redirect("/sign-in");
  redirect(getHomePath(user));
}
