import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        (token as Record<string, unknown>).role = (user as { role?: string }).role;
        (token as Record<string, unknown>).uid = (user as { id?: string }).id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = (token as Record<string, unknown>).role as string;
        (session.user as { id?: string }).id = (token as Record<string, unknown>).uid as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
