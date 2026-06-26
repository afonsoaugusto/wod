import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { getSessionUser, isCoach } from "@/lib/guards";
import { users, groups, assignments } from "@/lib/models";
import { getWorkoutIds } from "@/lib/workouts";
import StudentForm from "@/components/StudentForm";
import GroupForm from "@/components/GroupForm";
import AssignmentForm from "@/components/AssignmentForm";
import SignOutButton from "@/components/SignOutButton";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  if (!isCoach(me.role)) redirect("/dashboard");

  const [usersCol, groupsCol, assignmentsCol] = await Promise.all([
    users(),
    groups(),
    assignments(),
  ]);

  const studentDocs = await usersCol
    .find({ role: "student", coachId: me.id })
    .sort({ createdAt: -1 })
    .toArray();

  // Backfill: garante um shareToken para alunos cadastrados antes desta versão.
  for (const s of studentDocs) {
    if (!s.shareToken) {
      const shareToken = randomBytes(12).toString("hex");
      await usersCol.updateOne({ _id: s._id }, { $set: { shareToken } });
      s.shareToken = shareToken;
    }
  }
  const groupDocs = await groupsCol
    .find({ coachId: me.id })
    .sort({ createdAt: -1 })
    .toArray();
  const assignmentDocs = await assignmentsCol
    .find({ coachId: me.id })
    .sort({ createdAt: -1 })
    .toArray();

  const students = studentDocs.map((s) => ({ id: s._id!.toString(), name: s.name }));
  const groupOptions = groupDocs.map((g) => ({ id: g._id!.toString(), name: g.name }));
  const workoutIds = getWorkoutIds();

  const nameById = new Map<string, string>();
  students.forEach((s) => nameById.set(s.id, s.name));
  groupOptions.forEach((g) => nameById.set(g.id, g.name));

  return (
    <>
      <div className="topbar">
        <span className="brand">WOD · Coach</span>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <a href="/timer" target="_blank" rel="noreferrer">
            Abrir timer
          </a>
          <SignOutButton />
        </div>
      </div>

      <div className="container">
        <p className="muted">
          Olá, {me.name || me.email} · <span className="badge">{me.role}</span>
        </p>

        <div className="grid">
          <div className="card">
            <h2>Novo aluno</h2>
            <StudentForm />
          </div>

          <div className="card">
            <h2>Novo grupo</h2>
            <GroupForm students={students} />
          </div>

          <div className="card">
            <h2>Associar próximo treino</h2>
            <AssignmentForm students={students} groups={groupOptions} workoutIds={workoutIds} />
          </div>
        </div>

        <div className="card">
          <h2>Alunos ({students.length})</h2>
          <ul className="list">
            {studentDocs.map((s) => (
              <li key={s._id!.toString()}>
                <strong>{s.name}</strong> <span className="muted">· {s.email}</span>
                {s.shareToken && (
                  <div className="muted">
                    Link sem login:{" "}
                    <a href={`/timer?aluno=${s.shareToken}`} target="_blank" rel="noreferrer">
                      /timer?aluno={s.shareToken}
                    </a>
                  </div>
                )}
              </li>
            ))}
            {students.length === 0 && <li className="muted">Nenhum aluno ainda.</li>}
          </ul>
        </div>

        <div className="card">
          <h2>Grupos ({groupOptions.length})</h2>
          <ul className="list">
            {groupDocs.map((g) => (
              <li key={g._id!.toString()}>
                <strong>{g.name}</strong>{" "}
                <span className="muted">· {g.studentIds.length} aluno(s)</span>
              </li>
            ))}
            {groupOptions.length === 0 && <li className="muted">Nenhum grupo ainda.</li>}
          </ul>
        </div>

        <div className="card">
          <h2>Treinos associados ({assignmentDocs.length})</h2>
          <ul className="list">
            {assignmentDocs.map((a) => (
              <li key={a._id!.toString()}>
                <strong>{a.title}</strong>{" "}
                <span className="badge">{a.targetType === "group" ? "Grupo" : "Aluno"}</span>{" "}
                <span className="muted">
                  · {nameById.get(a.targetId) || "—"}
                  {a.scheduledFor ? ` · ${a.scheduledFor}` : ""}
                  {a.workoutId ? ` · template: ${a.workoutId}` : ""}
                </span>
                {a.details && <div className="muted">{a.details}</div>}
              </li>
            ))}
            {assignmentDocs.length === 0 && (
              <li className="muted">Nenhum treino associado ainda.</li>
            )}
          </ul>
        </div>
      </div>
    </>
  );
}
