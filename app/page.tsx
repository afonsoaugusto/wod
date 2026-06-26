import { redirect } from "next/navigation";
import { getSessionUser, isCoach } from "@/lib/guards";

export default async function Home() {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  if (isCoach(me.role)) redirect("/admin");
  redirect("/dashboard");
}
