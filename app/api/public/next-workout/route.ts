import { NextResponse } from "next/server";
import { users, groups, assignments } from "@/lib/models";

export const runtime = "nodejs";

// Endpoint público (sem login): dado o token do aluno, devolve o próximo treino.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = (searchParams.get("token") || "").trim();
  if (!token) {
    return NextResponse.json({ found: false, error: "Token ausente" }, { status: 400 });
  }

  const usersCol = await users();
  const student = await usersCol.findOne({ shareToken: token, role: "student" });
  if (!student) {
    return NextResponse.json({ found: false, error: "Aluno não encontrado" }, { status: 404 });
  }

  const studentId = student._id!.toString();
  const groupsCol = await groups();
  const myGroups = await groupsCol.find({ studentIds: studentId }).toArray();
  const groupIds = myGroups.map((g) => g._id!.toString());

  const assignmentsCol = await assignments();
  const next = await assignmentsCol
    .find({
      $or: [
        { targetType: "student", targetId: studentId },
        { targetType: "group", targetId: { $in: groupIds } },
      ],
    })
    .sort({ createdAt: -1 })
    .limit(1)
    .next();

  return NextResponse.json({
    found: true,
    student: { name: student.name },
    assignment: next
      ? {
          title: next.title,
          scheduledFor: next.scheduledFor ?? null,
          details: next.details ?? null,
          workoutId: next.workoutId ?? null,
        }
      : null,
  });
}
