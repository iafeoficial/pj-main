import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Field } from "@/components/ui/Field";
import { isSupabaseConfigured } from "@/lib/supabase";

function BrandMark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img src="/logo-iafe.png" alt="IAFÉ" className="h-11 w-11 object-contain" />
      <div className="leading-none">
        <p className="font-display text-2xl font-semibold tracking-tight text-white">IAFÉ</p>
        <p className="mt-0.5 font-sans text-xs font-medium tracking-[0.35em] text-brand-highlight">P J</p>
      </div>
    </div>
  );
}

function BrandPanel() {
  return (
    <aside className="relative flex flex-col overflow-hidden bg-primary px-8 py-8 text-primary-foreground md:min-h-screen md:justify-between md:px-12 md:py-12">
      <img
        src="/logo-iafe.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute -bottom-8 -right-10 h-[22rem] w-[22rem] object-contain opacity-[0.08]"
      />
      <div className="relative z-10">
        <BrandMark />
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-brand-highlight">
          Finanças PJ
        </p>
        <h1 className="mt-3 max-w-sm font-display text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
          Gestão financeira multiempresa
        </h1>
        <p className="mt-4 hidden max-w-sm text-sm leading-relaxed text-white/75 md:block">
          Fluxo de caixa, contas a pagar e receber, DRE e conciliação em uma plataforma pensada para o dia a
          dia da sua PJ.
        </p>
      </div>
      <p className="relative z-10 mt-6 text-xs text-white/50 md:mt-0">© 2026 IAFÉ TECNOLOGIA LTDA</p>
    </aside>
  );
}

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
        setInfo(
          "Se este e-mail estiver cadastrado, enviamos um link para definir uma nova senha. Abra o link neste navegador."
        );
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

  const tituloForm =
    passwordRecovery
      ? "Nova senha"
      : mode === "forgot"
        ? "Recuperar acesso"
        : mode === "signup"
          ? "Crie sua conta"
          : "Bem-vindo de volta";

  const subtituloForm =
    passwordRecovery
      ? session
        ? "Defina a senha da sua conta. Depois você entra normalmente."
        : "Este link expirou ou já foi usado. Peça um novo e-mail na tela de entrada."
      : mode === "forgot"
        ? "Informe o e-mail cadastrado. Enviaremos um link para criar uma nova senha."
        : mode === "signup"
          ? "Preencha os dados para começar a usar o IAFÉ PJ."
          : "Acesse sua conta para continuar.";

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      <BrandPanel />

      <div className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          {!configured && (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Supabase não configurado. Defina <code>VITE_SUPABASE_URL</code> e{" "}
              <code>VITE_SUPABASE_ANON_KEY</code> no <code>.env</code>.
            </div>
          )}

          <div className="mb-6">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">{tituloForm}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{subtituloForm}</p>
          </div>

          {passwordRecovery ? (
            <form onSubmit={salvarNovaSenha} className="space-y-4">
              {session && (
                <>
                  <Field label="Nova senha" required>
                    <input
                      className="input"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </Field>
                  <Field label="Confirmar senha" required>
                    <input
                      className="input"
                      type="password"
                      placeholder="Repita a nova senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </Field>
                </>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              {session ? (
                <button className="btn-primary h-11 w-full" type="submit" disabled={busy || !configured}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Salvar senha
                </button>
              ) : (
                <button className="btn-primary h-11 w-full" type="button" onClick={() => void cancelarRecuperacao()}>
                  Voltar para entrar
                </button>
              )}
            </form>
          ) : (
            <>
              <div className="mb-6 grid grid-cols-2 gap-1 rounded-full bg-secondary p-1 text-sm">
                <button
                  className={`rounded-full px-3 py-2 font-medium transition-colors ${
                    mode === "login" || mode === "forgot"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => trocarModo("login")}
                  type="button"
                >
                  Entrar
                </button>
                <button
                  className={`rounded-full px-3 py-2 font-medium transition-colors ${
                    mode === "signup"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => trocarModo("signup")}
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
                    placeholder="seu@email.com"
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
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                    />
                  </Field>
                )}
                {mode === "login" && (
                  <div className="-mt-1 text-right">
                    <button
                      type="button"
                      className="text-sm font-medium text-primary hover:underline"
                      onClick={() => trocarModo("forgot")}
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                )}

                {error && <p className="text-sm text-destructive">{error}</p>}
                {info && <p className="text-sm text-success">{info}</p>}

                <button className="btn-primary h-11 w-full" type="submit" disabled={busy || !configured}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link"}
                </button>
                {mode === "forgot" && (
                  <button className="btn-ghost w-full" type="button" onClick={() => trocarModo("login")}>
                    Voltar para entrar
                  </button>
                )}
              </form>

              {mode === "login" && (
                <p className="mt-6 text-center text-sm text-muted-foreground">
                  Ainda não tem conta?{" "}
                  <button
                    type="button"
                    className="font-medium text-primary hover:underline"
                    onClick={() => trocarModo("signup")}
                  >
                    Criar conta
                  </button>
                </p>
              )}
              {mode === "signup" && (
                <p className="mt-6 text-center text-sm text-muted-foreground">
                  Já tem conta?{" "}
                  <button
                    type="button"
                    className="font-medium text-primary hover:underline"
                    onClick={() => trocarModo("login")}
                  >
                    Entrar
                  </button>
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
