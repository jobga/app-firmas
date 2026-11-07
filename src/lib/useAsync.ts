/* Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo */
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from './api';

/** Carga datos de la API y expone estado de carga/error y una función para recargar. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);

  const reload = useCallback(() => {
    let alive = true;
    setLoading(true);
    run()
      .then((d) => { if (alive) { setData(d); setError(null); } })
      .catch((e) => { if (alive) setError(e instanceof ApiError ? e : new ApiError(0, String(e))); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [run]);

  useEffect(() => reload(), [reload]);
  return { data, error, loading, reload, setData };
}
