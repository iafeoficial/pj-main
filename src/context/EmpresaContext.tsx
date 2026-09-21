import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Empresa } from "@/types/domain";
import type { Papel } from "@/lib/rbac";
import { empresaService } from "@/data/services";
import { membroService } from "@/data/membros";
import { useAuth } from "./AuthContext";

const ACTIVE_KEY = "financas_pj:empresa_ativa";

interface EmpresaContextValue {
  empresas: Empresa[];
  empresaAtiva: Empresa | null;
  /** Papel do usuário atual na empresa ativa (RBAC). */
  papel: Papel | null;
  loading: boolean;
  /** Versão usada para forçar re-leitura após mutações de dados. */
  version: number;
  setEmpresaAtiva: (id: string) => void;
  refreshEmpresas: () => Promise<void>;
  /** Invalida caches dependentes de dados (listas, dashboard etc.). */
  bumpData: () => void;
}

const Ctx = createContext<EmpresaContextValue | null>(null);

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  // Estável no TOKEN_REFRESHED — evita remount de formulários em RequireEmpresa.
  const userId = user?.id ?? null;
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [ativaId, setAtivaId] = useState<string | null>(() =>
    localStorage.getItem(ACTIVE_KEY)
  );
  const [version, setVersion] = useState(0);
  const [papeis, setPapeis] = useState<Record<string, Papel>>({});
  const initialLoadDone = useRef(false);

  const refreshEmpresas = useCallback(async () => {
    if (!userId) {
      setEmpresas([]);
      setPapeis({});
      setLoading(false);
      initialLoadDone.current = false;
      return;
    }
    // Spinner só no boot; refresh em background (token / manual) não desmonta filhos.
    if (!initialLoadDone.current) setLoading(true);
    try {
      const [lista, assoc] = await Promise.all([
        empresaService.list(),
        membroService.minhasAssociacoes(userId),
      ]);
      setEmpresas(lista);
      setPapeis(Object.fromEntries(assoc.map((a) => [a.empresaId, a.papel])));
      initialLoadDone.current = true;
    } catch (e) {
      console.error("[empresa] falha ao carregar empresas:", e);
      setEmpresas([]);
      setPapeis({});
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const bumpData = useCallback(() => setVersion((v) => v + 1), []);

  const setEmpresaAtiva = useCallback((id: string) => {
    setAtivaId(id);
    localStorage.setItem(ACTIVE_KEY, id);
  }, []);

  // Recarrega empresas quando o usuário muda (login/logout), não no refresh de token.
  useEffect(() => {
    refreshEmpresas();
  }, [refreshEmpresas]);

  // Garante uma empresa ativa válida.
  useEffect(() => {
    if (empresas.length === 0) return;
    const valid = ativaId && empresas.some((e) => e.id === ativaId);
    if (!valid) setEmpresaAtiva(empresas[0].id);
  }, [empresas, ativaId, setEmpresaAtiva]);

  const empresaAtiva = useMemo(
    () => empresas.find((e) => e.id === ativaId) ?? null,
    [empresas, ativaId]
  );

  const papel = useMemo<Papel | null>(
    () => (empresaAtiva ? papeis[empresaAtiva.id] ?? null : null),
    [empresaAtiva, papeis]
  );

  const value = useMemo(
    () => ({
      empresas,
      empresaAtiva,
      papel,
      loading,
      version,
      setEmpresaAtiva,
      refreshEmpresas,
      bumpData,
    }),
    [empresas, empresaAtiva, papel, loading, version, setEmpresaAtiva, refreshEmpresas, bumpData]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useEmpresa(): EmpresaContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useEmpresa deve ser usado dentro de EmpresaProvider");
  return ctx;
}
