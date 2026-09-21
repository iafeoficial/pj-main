import { useEffect, useRef } from "react";
import { useEmpresa } from "@/context/EmpresaContext";

const PREFIX = "financas_pj:draft";
const DEBOUNCE_MS = 300;

export interface FormDraftPayload<TForm, TExtra = undefined> {
  open: boolean;
  form: TForm;
  editingId: string | null;
  extra?: TExtra;
}

function storageKey(empresaId: string, formKey: string) {
  return `${PREFIX}:${empresaId}:${formKey}`;
}

function readDraft<TForm, TExtra>(
  empresaId: string,
  formKey: string
): FormDraftPayload<TForm, TExtra> | null {
  try {
    const raw = sessionStorage.getItem(storageKey(empresaId, formKey));
    if (!raw) return null;
    return JSON.parse(raw) as FormDraftPayload<TForm, TExtra>;
  } catch {
    return null;
  }
}

function writeDraft<TForm, TExtra>(
  empresaId: string,
  formKey: string,
  payload: FormDraftPayload<TForm, TExtra>
) {
  try {
    sessionStorage.setItem(storageKey(empresaId, formKey), JSON.stringify(payload));
  } catch {
    // quota / private mode — ignora
  }
}

function removeDraft(empresaId: string, formKey: string) {
  try {
    sessionStorage.removeItem(storageKey(empresaId, formKey));
  } catch {
    // ignore
  }
}

/**
 * Persiste rascunho de modal em sessionStorage (chave por empresa + formKey).
 * Restaura no mount se o modal estava aberto; salva com debounce enquanto aberto.
 * Chame clearDraft() ao Cancelar ou Salvar com sucesso.
 */
export function useFormDraft<TForm, TExtra = undefined>(
  formKey: string,
  state: FormDraftPayload<TForm, TExtra>,
  onRestore: (draft: FormDraftPayload<TForm, TExtra>) => void
): { clearDraft: () => void } {
  const { empresaAtiva } = useEmpresa();
  const empresaId = empresaAtiva?.id ?? null;
  const restoredRef = useRef(false);
  const skipPersistRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;
  const clearedRef = useRef(false);

  // Restaura uma vez no mount (ou quando empresa/formKey mudam).
  useEffect(() => {
    restoredRef.current = false;
    skipPersistRef.current = false;
    clearedRef.current = false;
    if (!empresaId) return;
    const draft = readDraft<TForm, TExtra>(empresaId, formKey);
    if (draft?.open) {
      restoredRef.current = true;
      skipPersistRef.current = true;
      onRestoreRef.current(draft);
    }
  }, [empresaId, formKey]);

  // Persiste enquanto o modal estiver aberto (debounce).
  useEffect(() => {
    if (!empresaId || !state.open) return;
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }
    clearedRef.current = false;
    const timer = window.setTimeout(() => {
      writeDraft(empresaId, formKey, stateRef.current);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [empresaId, formKey, state.open, state.form, state.editingId, state.extra]);

  // Flush no unmount para não perder rascunho na navegação interna.
  useEffect(() => {
    return () => {
      if (!empresaId || clearedRef.current) return;
      const s = stateRef.current;
      if (s.open) writeDraft(empresaId, formKey, s);
    };
  }, [empresaId, formKey]);

  return {
    clearDraft: () => {
      clearedRef.current = true;
      if (empresaId) removeDraft(empresaId, formKey);
    },
  };
}
