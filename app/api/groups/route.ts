import { NextResponse } from "next/server";
import { getSessionUser, isCoach } from "@/lib/guards";
import { groups } from "@/lib/models";

export const runtime = "nodejs";

export async function GET() {
  const me = await getSessionUser();
  if (!me || !isCoach(me.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const col = await groups();
  const list = await col.find({ coachId: me.id }).sort({ createdAt: -1 }).toArray();

  return NextResponse.json(
    list.map((g) => ({
      id: g._id?.toString(),
      name: g.name,
      studentIds: g.studentIds,
      createdAt: g.createdAt,
    }))
  );
}

export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me || !isCoach(me.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { name?: string; studentIds?: string[] }
    | null;

  const name = String(body?.name ?? "").trim();
  const studentIds = Array.isArray(body?.studentIds)
    ? body!.studentIds.map((id) => String(id))
    : [];

  if (!name) {
    return NextResponse.json({ error: "Nome do grupo é obrigatório" }, { status: 400 });
  }

  const col = await groups();
  const result = await col.insertOne({
    name,
    coachId: me.id,
    studentIds,
    createdAt: new Date(),
  });

  return NextResponse.json({ id: result.insertedId.toString(), name, studentIds });
}
