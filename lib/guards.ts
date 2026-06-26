import { auth } from "@/auth";
import type { Role } from "@/lib/models";

export interface SessionUser {
  id: string;
  email?: string | null;
  name?: string | null;
  role: Role;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
  };
}

export function isCoach(role?: Role | string): boolean {
  return role === "coach" || role === "admin";
}
