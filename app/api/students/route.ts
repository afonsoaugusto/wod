import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSessionUser, isCoach } from "@/lib/guards";
import { users } from "@/lib/models";

export const runtime = "nodejs";

export async function GET() {
  const me = await getSessionUser();
  if (!me || !isCoach(me.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const col = await users();
  const list = await col
    .find({ role: "student", coachId: me.id })
    .sort({ createdAt: -1 })
    .toArray();

  return NextResponse.json(
    list.map((s) => ({
      id: s._id?.toString(),
      name: s.name,
      email: s.email,
      createdAt: s.createdAt,
    }))
  );
}

export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me || !isCoach(me.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { name?: string; email?: string; password?: string }
    | null;

  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").toLowerCase().trim();
  const password = String(body?.password ?? "");

  if (!name || !email || password.length < 6) {
    return NextResponse.json(
      { error: "Nome, email e senha (mínimo 6 caracteres) são obrigatórios" },
      { status: 400 }
    );
  }

  const col = await users();
  const exists = await col.findOne({ email });
  if (exists) {
    return NextResponse.json({ error: "Email já cadastrado" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const shareToken = randomBytes(12).toString("hex");
  const result = await col.insertOne({
    name,
    email,
    passwordHash,
    role: "student",
    coachId: me.id,
    shareToken,
    createdAt: new Date(),
  });

  return NextResponse.json({ id: result.insertedId.toString(), name, email, shareToken });
}
