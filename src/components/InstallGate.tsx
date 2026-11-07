/* Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo */
import { useEffect, useState, type ReactNode } from 'react';
import { apiUrl, appUrl } from '../lib/base';

/** Si la plataforma aún no está instalada, lleva al asistente de instalación. */
export function InstallGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    fetch(apiUrl('/status'))
      .then((r) => r.json())
      .then((s) => { if (s.installed === false) window.location.replace(s.installUrl ?? appUrl('/install/')); else setReady(true); })
      .catch(() => setReady(true));
  }, []);
  return ready ? <>{children}</> : <div className="page-loading" aria-busy="true">Cargando…</div>;
}
