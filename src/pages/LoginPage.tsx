import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Field } from "@/components/ui/Field";
import { isSupabaseConfigured } from "@/lib/supabase";

export function LoginPage() {
  const { signIn, signUp, requestPasswordReset, updatePassword, cancelarRecuperacao, passwordRecovery, session } =
    useAuth();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const configured = isSupabaseConfigured();

  function trocarModo(next: "login" | "signup" | "forgot") {
    setMode(next);
    setError("");
    setInfo("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (mode === "forgot") {
      if (!email) {
        setError("Informe o e-mail cadastrado.");
        return;
      }
      setBusy(true);
      try {
        await requestPasswordReset(email);
        setInfo("Se este e-mail estiver cadastrado, enviamos um link para definir uma nova senha. Abra o link neste navegador.");
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusy(false);
      }
      return;
    }
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

  async function salvarNovaSenha(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (password.length < 6) {
      setError("A senha deve ter ao menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("A confirmação não confere com a nova senha.");
      return;
    }
    setBusy(true);
    try {
      await updatePassword(password);
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
          <img src="/logo-iafe.png" alt="IAFE" className="h-12 w-12 object-contain" />
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

          {passwordRecovery ? (
            <form onSubmit={salvarNovaSenha} className="space-y-4">
              <div>
                <h2 className="text-base font-semibold">Nova senha</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {session
                    ? "Defina a senha da sua conta. Depois você entra normalmente."
                    : "Este link expirou ou já foi usado. Peça um novo e-mail na tela de entrada."}
                </p>
              </div>
              {session && (
                <>
                  <Field label="Nova senha" required>
                    <input
                      className="input"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </Field>
                  <Field label="Confirmar senha" required>
                    <input
                      className="input"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </Field>
                </>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              {session ? (
                <button className="btn-primary w-full" type="submit" disabled={busy || !configured}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Salvar senha
                </button>
              ) : (
                <button className="btn-primary w-full" type="button" onClick={() => void cancelarRecuperacao()}>
                  Voltar para entrar
                </button>
              )}
            </form>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-2 gap-1 rounded-md bg-muted p-1 text-sm">
                <button
                  className={`rounded px-3 py-1.5 font-medium transition-colors ${
                    mode === "login" || mode === "forgot" ? "bg-card shadow-sm" : "text-muted-foreground"
                  }`}
                  onClick={() => trocarModo("login")}
                  type="button"
                >
                  Entrar
                </button>
                <button
                  className={`rounded px-3 py-1.5 font-medium transition-colors ${
                    mode === "signup" ? "bg-card shadow-sm" : "text-muted-foreground"
                  }`}
                  onClick={() => trocarModo("signup")}
                  type="button"
                >
                  Criar conta
                </button>
              </div>

              <form onSubmit={submit} className="space-y-4">
                {mode === "forgot" && (
                  <p className="text-sm text-muted-foreground">
                    Informe o e-mail cadastrado. Enviaremos um link para você criar uma nova senha.
                  </p>
                )}
                <Field label="E-mail" required>
                  <input
                    className="input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </Field>
                {mode !== "forgot" && (
                  <Field label="Senha" required>
                    <input
                      className="input"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                    />
                  </Field>
                )}
                {mode === "login" && (
                  <div className="-mt-2 text-right">
                    <button
                      type="button"
                      className="text-sm text-primary hover:underline"
                      onClick={() => trocarModo("forgot")}
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                )}

                {error && <p className="text-sm text-destructive">{error}</p>}
                {info && <p className="text-sm text-emerald-600">{info}</p>}

                <button className="btn-primary w-full" type="submit" disabled={busy || !configured}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link"}
                </button>
                {mode === "forgot" && (
                  <button className="btn-ghost w-full" type="button" onClick={() => trocarModo("login")}>
                    Voltar para entrar
                  </button>
                )}
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
