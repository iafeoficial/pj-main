import { useEffect, useState } from "react";

interface AsyncState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

/**
 * Carrega dados assíncronos e re-executa quando `deps` mudam.
 * Use `version` do EmpresaContext em `deps` para revalidar após mutações.
 */
export function useAsyncData<T>(
  fn: () => Promise<T>,
  deps: unknown[],
  initial: T
): AsyncState<T> {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fn()
      .then((d) => {
        if (active) {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
}
