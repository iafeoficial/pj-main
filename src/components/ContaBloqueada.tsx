import { ShieldOff } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

/** Tela cheia quando o usuário está bloqueado na plataforma. */
export function ContaBloqueada() {
  const { profile, signOut } = useAuth();
  const motivo =
    profile?.bloqueadoMotivo?.trim() ||
    "Sua conta foi bloqueada. Entre em contato com o suporte IAFÉ.";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-700">
        <ShieldOff className="h-7 w-7" />
      </div>
      <div className="max-w-md space-y-2">
        <h1 className="font-display text-xl font-semibold tracking-tight">Conta bloqueada</h1>
        <p className="text-sm text-muted-foreground">{motivo}</p>
      </div>
      <button type="button" className="btn-outline" onClick={() => void signOut()}>
        Sair
      </button>
    </div>
  );
}
