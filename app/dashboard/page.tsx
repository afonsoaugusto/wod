import { redirect } from "next/navigation";
import { getSessionUser, isCoach } from "@/lib/guards";
import { assignments, groups } from "@/lib/models";
import SignOutButton from "@/components/SignOutButton";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  if (isCoach(me.role)) redirect("/admin");

  const [assignmentsCol, groupsCol] = await Promise.all([assignments(), groups()]);

  const myGroups = await groupsCol.find({ studentIds: me.id }).toArray();
  const groupIds = myGroups.map((g) => g._id!.toString());

  const myAssignments = await assignmentsCol
    .find({
      $or: [
        { targetType: "student", targetId: me.id },
        { targetType: "group", targetId: { $in: groupIds } },
      ],
    })
    .sort({ createdAt: -1 })
    .toArray();

  const next = myAssignments[0];

  return (
    <>
      <div className="topbar">
        <span className="brand">WOD · Aluno</span>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <a href="/timer" target="_blank" rel="noreferrer">
            Abrir timer
          </a>
          <SignOutButton />
        </div>
      </div>

      <div className="container">
        <p className="muted">Olá, {me.name || me.email}</p>

        <div className="card">
          <h2>Próximo treino</h2>
          {next ? (
            <>
              <h3 style={{ margin: "0 0 6px" }}>{next.title}</h3>
              <p className="muted">
                {next.scheduledFor ? `Previsto para ${next.scheduledFor}` : "Sem data definida"}
                {next.workoutId ? ` · template: ${next.workoutId}` : ""}
              </p>
              {next.details && <p>{next.details}</p>}
              <a href="/timer" target="_blank" rel="noreferrer">
                <button>Abrir no timer</button>
              </a>
            </>
          ) : (
            <p className="muted">Nenhum treino associado ainda. Fale com seu coach.</p>
          )}
        </div>

        {myAssignments.length > 1 && (
          <div className="card">
            <h2>Histórico de treinos</h2>
            <ul className="list">
              {myAssignments.slice(1).map((a) => (
                <li key={a._id!.toString()}>
                  <strong>{a.title}</strong>{" "}
                  <span className="muted">
                    {a.scheduledFor ? `· ${a.scheduledFor}` : ""}
                    {a.workoutId ? ` · ${a.workoutId}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}
