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
 * (ex.: outra empresa). Só grava quando o usuário altera o valor.
 */
export function usePersistedState<T>(key: string, fallback: T): [T, (next: SetStateAction<T>) => void] {
  const fallbackRef = useRef(fallback);
  fallbackRef.current = fallback;
  const [state, setState] = useState<T>(() => readJson(key, fallback));

  useEffect(() => {
    setState(readJson(key, fallbackRef.current));
  }, [key]);

  const setPersisted = useCallback(
    (next: SetStateAction<T>) => {
      setState((prev) => {
        const value = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        writeJson(key, value);
        return value;
      });
    },
    [key]
  );

  return [state, setPersisted];
}
