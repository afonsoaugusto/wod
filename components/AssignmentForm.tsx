"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Option {
  id: string;
  name: string;
}

export default function AssignmentForm({
  students,
  groups,
  workoutIds,
}: {
  students: Option[];
  groups: Option[];
  workoutIds: string[];
}) {
  const router = useRouter();
  const [targetType, setTargetType] = useState<"student" | "group">("student");
  const [targetId, setTargetId] = useState("");
  const [title, setTitle] = useState("");
  const [workoutId, setWorkoutId] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [details, setDetails] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const options = targetType === "student" ? students : groups;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    const res = await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetId, title, workoutId, scheduledFor, details }),
    });
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg({ type: "error", text: data.error || "Erro ao associar treino" });
      return;
    }
    setMsg({ type: "ok", text: "Treino associado." });
    setTitle("");
    setWorkoutId("");
    setScheduledFor("");
    setDetails("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      {msg && <div className={msg.type}>{msg.text}</div>}
      <label htmlFor="a-type">Associar a</label>
      <select
        id="a-type"
        value={targetType}
        onChange={(e) => {
          setTargetType(e.target.value as "student" | "group");
          setTargetId("");
        }}
      >
        <option value="student">Aluno</option>
        <option value="group">Grupo</option>
      </select>

      <label htmlFor="a-target">{targetType === "student" ? "Aluno" : "Grupo"}</label>
      <select id="a-target" value={targetId} onChange={(e) => setTargetId(e.target.value)} required>
        <option value="">Selecione...</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>

      <label htmlFor="a-title">Título do treino</label>
      <input id="a-title" value={title} onChange={(e) => setTitle(e.target.value)} required />

      <label htmlFor="a-workout">Template do timer (opcional)</label>
      <select id="a-workout" value={workoutId} onChange={(e) => setWorkoutId(e.target.value)}>
        <option value="">Nenhum</option>
        {workoutIds.map((id) => (
          <option key={id} value={id}>
            {id}
          </option>
        ))}
      </select>

      <label htmlFor="a-date">Data prevista (opcional)</label>
      <input
        id="a-date"
        type="date"
        value={scheduledFor}
        onChange={(e) => setScheduledFor(e.target.value)}
      />

      <label htmlFor="a-details">Planilha / observações (opcional)</label>
      <textarea id="a-details" value={details} onChange={(e) => setDetails(e.target.value)} />

      <button type="submit" disabled={loading}>
        {loading ? "Salvando..." : "Associar próximo treino"}
      </button>
    </form>
  );
}
