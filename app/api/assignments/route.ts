import { NextResponse } from "next/server";
import { getSessionUser, isCoach } from "@/lib/guards";
import { assignments, groups } from "@/lib/models";

export const runtime = "nodejs";

export async function GET() {
  const me = await getSessionUser();
  if (!me) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const col = await assignments();

  if (isCoach(me.role)) {
    const list = await col.find({ coachId: me.id }).sort({ createdAt: -1 }).toArray();
    return NextResponse.json(list.map(serialize));
  }

  // Student: assignments targeting them directly or via a group they belong to.
  const groupCol = await groups();
  const myGroups = await groupCol.find({ studentIds: me.id }).toArray();
  const groupIds = myGroups.map((g) => g._id!.toString());

  const list = await col
    .find({
      $or: [
        { targetType: "student", targetId: me.id },
        { targetType: "group", targetId: { $in: groupIds } },
      ],
    })
    .sort({ createdAt: -1 })
    .toArray();

  return NextResponse.json(list.map(serialize));
}

export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me || !isCoach(me.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    targetType?: string;
    targetId?: string;
    title?: string;
    workoutId?: string;
    details?: string;
    scheduledFor?: string;
  } | null;

  const targetType = body?.targetType === "group" ? "group" : "student";
  const targetId = String(body?.targetId ?? "").trim();
  const title = String(body?.title ?? "").trim();

  if (!targetId || !title) {
    return NextResponse.json(
      { error: "Alvo e título são obrigatórios" },
      { status: 400 }
    );
  }

  const col = await assignments();
  const result = await col.insertOne({
    coachId: me.id,
    targetType,
    targetId,
    title,
    workoutId: body?.workoutId ? String(body.workoutId) : null,
    details: body?.details ? String(body.details) : null,
    scheduledFor: body?.scheduledFor ? String(body.scheduledFor) : null,
    createdAt: new Date(),
  });

  return NextResponse.json({ id: result.insertedId.toString() });
}

type AssignmentLike = {
  _id?: { toString(): string };
  targetType: string;
  targetId: string;
  title: string;
  workoutId?: string | null;
  details?: string | null;
  scheduledFor?: string | null;
  createdAt: Date;
};

function serialize(a: AssignmentLike) {
  return {
    id: a._id?.toString(),
    targetType: a.targetType,
    targetId: a.targetId,
    title: a.title,
    workoutId: a.workoutId ?? null,
    details: a.details ?? null,
    scheduledFor: a.scheduledFor ?? null,
    createdAt: a.createdAt,
  };
}
