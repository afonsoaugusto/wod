import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { users } from "@/lib/models";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const token = req.headers.get("x-setup-token");
  if (!process.env.SETUP_TOKEN || token !== process.env.SETUP_TOKEN) {
    return NextResponse.json({ error: "Token de setup inválido" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { email?: string; password?: string; name?: string }
    | null;

  const email = String(body?.email ?? "").toLowerCase().trim();
  const password = String(body?.password ?? "");
  const name = String(body?.name ?? "Admin").trim();

  if (!email || password.length < 8) {
    return NextResponse.json(
      { error: "Email e senha (mínimo 8 caracteres) são obrigatórios" },
      { status: 400 }
    );
  }

  const col = await users();
  const count = await col.countDocuments();
  if (count > 0) {
    return NextResponse.json(
      { error: "Setup já foi realizado. Já existem usuários." },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await col.insertOne({ email, name, passwordHash, role: "admin", createdAt: new Date() });

  return NextResponse.json({ ok: true, message: "Admin criado com sucesso" });
}
