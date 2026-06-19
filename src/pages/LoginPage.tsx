import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Field } from "@/components/ui/Field";
import { isSupabaseConfigured } from "@/lib/supabase";

export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const configured = isSupabaseConfigured();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!email || !password) {
      setError("Informe e-mail e senha.");
      return;
    }
    if (mode === "signup" && password.length < 6) {
      setError("A senha deve ter ao menos 6 caracteres.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        await signIn(email, password);
      } else {
        const { needsConfirmation } = await signUp(email, password);
        if (needsConfirmation) {
          setInfo("Conta criada! Confirme o e-mail recebido para acessar.");
          setMode("login");
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground">
            <span className="text-lg font-bold">PJ</span>
          </div>
          <h1 className="text-xl font-semibold">Finanças PJ</h1>
          <p className="text-sm text-muted-foreground">Gestão financeira multiempresa</p>
        </div>

        <div className="card p-6">
          {!configured && (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Supabase não configurado. Defina <code>VITE_SUPABASE_URL</code> e{" "}
              <code>VITE_SUPABASE_ANON_KEY</code> no <code>.env</code>.
            </div>
          )}

          <div className="mb-4 grid grid-cols-2 gap-1 rounded-md bg-muted p-1 text-sm">
            <button
              className={`rounded px-3 py-1.5 font-medium transition-colors ${
                mode === "login" ? "bg-card shadow-sm" : "text-muted-foreground"
              }`}
              onClick={() => setMode("login")}
              type="button"
            >
              Entrar
            </button>
            <button
              className={`rounded px-3 py-1.5 font-medium transition-colors ${
                mode === "signup" ? "bg-card shadow-sm" : "text-muted-foreground"
              }`}
              onClick={() => setMode("signup")}
              type="button"
            >
              Criar conta
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <Field label="E-mail" required>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </Field>
            <Field label="Senha" required>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </Field>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {info && <p className="text-sm text-emerald-600">{info}</p>}

            <button className="btn-primary w-full" type="submit" disabled={busy || !configured}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "login" ? "Entrar" : "Criar conta"}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Seus dados são isolados por usuário (RLS no Supabase).
        </p>
      </div>
    </div>
  );
}
