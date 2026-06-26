"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface StudentOption {
  id: string;
  name: string;
}

export default function GroupForm({ students }: { students: StudentOption[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, studentIds: selected }),
    });
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg({ type: "error", text: data.error || "Erro ao criar grupo" });
      return;
    }
    setMsg({ type: "ok", text: "Grupo criado." });
    setName("");
    setSelected([]);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      {msg && <div className={msg.type}>{msg.text}</div>}
      <label htmlFor="g-name">Nome do grupo</label>
      <input id="g-name" value={name} onChange={(e) => setName(e.target.value)} required />
      <label>Alunos no grupo</label>
      {students.length === 0 && <p className="muted">Cadastre alunos primeiro.</p>}
      {students.map((s) => (
        <label key={s.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            style={{ width: "auto", marginBottom: 0 }}
            checked={selected.includes(s.id)}
            onChange={() => toggle(s.id)}
          />
          {s.name}
        </label>
      ))}
      <button type="submit" disabled={loading} style={{ marginTop: 12 }}>
        {loading ? "Salvando..." : "Criar grupo"}
      </button>
    </form>
  );
}
