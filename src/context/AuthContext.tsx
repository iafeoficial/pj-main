import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { setCurrentUser } from "@/data/audit";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** Verdadeiro enquanto o usuário chegou pelo link de recuperação de senha. */
  passwordRecovery: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  cancelarRecuperacao: () => Promise<void>;
}

function erroAuth(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("rate limit") || m.includes("only request this") || m.includes("too many")) {
    return "Aguarde um instante antes de pedir outro e-mail.";
  }
  if (m.includes("unable to validate email") || m.includes("invalid email") || m.includes("email address")) {
    return "Informe um e-mail válido.";
  }
  if (m.includes("password") && (m.includes("at least") || m.includes("should be") || m.includes("weak"))) {
    return "A senha deve ter ao menos 6 caracteres.";
  }
  if (m.includes("same password") || m.includes("different from the old")) {
    return "A nova senha precisa ser diferente da atual.";
  }
  if (m.includes("redirect")) {
    return "Este endereço ainda não está liberado para recuperação de senha no Supabase.";
  }
  if (m.includes("session") || m.includes("expired") || m.includes("invalid")) {
    return "O link expirou ou já foi usado. Peça um novo e-mail.";
  }
  return "Não foi possível concluir. Tente de novo.";
}

function limparUrlDeAuth() {
  const url = new URL(window.location.href);
  url.hash = "";
  for (const key of ["code", "token_hash", "type", "error", "error_code", "error_description"]) {
    url.searchParams.delete(key);
  }
  const search = url.searchParams.toString();
  window.history.replaceState({}, "", url.pathname + (search ? `?${search}` : ""));
}

const Ctx = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const type = params.get("type");
    const tokenHash = params.get("token_hash");
    if (window.location.hash.includes("type=recovery") || type === "recovery") {
      setPasswordRecovery(true);
    }

    let cancelled = false;
    (async () => {
      if (tokenHash && type === "recovery") {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
        if (!cancelled && !error) setPasswordRecovery(true);
      }
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setSession(data.session);
      setCurrentUser(data.session?.user.email ?? null);
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      // TOKEN_REFRESHED: atualiza a sessão (novo JWT) sem cascata desnecessária —
      // EmpresaContext depende de user.id, estável neste evento.
      setSession((prev) => {
        if (
          event === "TOKEN_REFRESHED" &&
          prev?.user?.id &&
          s?.user?.id === prev.user.id
        ) {
          return s;
        }
        return s;
      });
      setCurrentUser(s?.user.email ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      passwordRecovery,
      async signIn(email, password) {
        if (!supabase) throw new Error("Supabase não configurado.");
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
      },
      async signUp(email, password) {
        if (!supabase) throw new Error("Supabase não configurado.");
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw new Error(error.message);
        // Sem sessão imediata ⇒ confirmação de e-mail está habilitada no projeto.
        return { needsConfirmation: !data.session };
      },
      async signOut() {
        if (!supabase) return;
        await supabase.auth.signOut();
      },
      async requestPasswordReset(email) {
        if (!supabase) throw new Error("Supabase não configurado.");
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/`,
        });
        if (error) throw new Error(erroAuth(error.message));
      },
      async updatePassword(password) {
        if (!supabase) throw new Error("Supabase não configurado.");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw new Error(erroAuth(error.message));
        limparUrlDeAuth();
        setPasswordRecovery(false);
      },
      async cancelarRecuperacao() {
        setPasswordRecovery(false);
        limparUrlDeAuth();
        if (supabase) await supabase.auth.signOut();
      },
    }),
    [session, loading, passwordRecovery]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
