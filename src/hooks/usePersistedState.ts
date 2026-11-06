import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota / private mode — ignora
  }
}

/**
 * Estado persistido em localStorage. Restaura no mount e ao mudar a chave
 * (ex.: outra empresa). Grava a cada alteração e de novo no unmount.
 */
export function usePersistedState<T>(key: string, fallback: T): [T, (next: SetStateAction<T>) => void] {
  const fallbackRef = useRef(fallback);
  fallbackRef.current = fallback;
  const keyRef = useRef(key);
  keyRef.current = key;
  const [state, setState] = useState<T>(() => readJson(key, fallback));
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const stored = readJson(key, fallbackRef.current);
    setState(stored);
    stateRef.current = stored;
  }, [key]);

  // Garante persistência ao sair da tela / trocar a chave (usa `key` do closure)
  useEffect(() => {
    return () => {
      writeJson(key, stateRef.current);
    };
  }, [key]);

  const setPersisted = useCallback((next: SetStateAction<T>) => {
    setState((prev) => {
      const value = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      writeJson(keyRef.current, value);
      stateRef.current = value;
      return value;
    });
  }, []);

  return [state, setPersisted];
}
