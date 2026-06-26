import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/guards";
import LoginForm from "@/components/LoginForm";

export default async function LoginPage() {
  const me = await getSessionUser();
  if (me) redirect("/");

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <h2>Entrar</h2>
        <p className="muted">Acesse sua conta de coach ou aluno.</p>
        <LoginForm />
      </div>
    </div>
  );
}
