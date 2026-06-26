import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      role?: "admin" | "coach" | "student";
    } & DefaultSession["user"];
  }

  interface User {
    role?: "admin" | "coach" | "student";
  }
}
