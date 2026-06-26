"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StudentForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    const res = await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg({ type: "error", text: data.error || "Erro ao cadastrar aluno" });
      return;
    }
    setMsg({ type: "ok", text: "Aluno cadastrado." });
    setName("");
    setEmail("");
    setPassword("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      {msg && <div className={msg.type}>{msg.text}</div>}
      <label htmlFor="s-name">Nome</label>
      <input id="s-name" value={name} onChange={(e) => setName(e.target.value)} required />
      <label htmlFor="s-email">Email</label>
      <input
        id="s-email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <label htmlFor="s-pass">Senha inicial</label>
      <input
        id="s-pass"
        type="text"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="mínimo 6 caracteres"
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? "Salvando..." : "Cadastrar aluno"}
      </button>
    </form>
  );
}
